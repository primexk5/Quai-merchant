const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

const oid = (s) => ethers.encodeBytes32String(s);
const usdq = (n) => ethers.parseUnits(String(n), 6); // MockStablecoin has 6 decimals
const NO_EXPIRY = 0;

describe('PayWithQuai', function () {
  const FEE_BPS = 50n; // 0.5%
  const AMOUNT = usdq(25); // 25.00 mUSDQ

  // Deploy the router, fund a payer, and allowlist both the stablecoin and native QUAI.
  async function setup(feeBps) {
    const [owner, merchant, payer, feeRecipient, other] = await ethers.getSigners();

    const token = await ethers.deployContract('MockStablecoin');
    await token.mint(payer.address, usdq(1000));

    const pay = await ethers.deployContract('PayWithQuai', [feeRecipient.address, feeBps]);
    await pay.setTokenAccepted(await token.getAddress(), true);
    await pay.setTokenAccepted(ethers.ZeroAddress, true); // enable native QUAI

    return { owner, merchant, payer, feeRecipient, other, token, pay };
  }

  const deployFixture = () => setup(FEE_BPS);
  const deployZeroFeeFixture = () => setup(0n);

  function expectedSplit(amount, feeBps) {
    const fee = (amount * feeBps) / 10000n;
    return { fee, net: amount - fee };
  }

  describe('deployment', function () {
    it('records owner, fee recipient and fee', async function () {
      const { pay, owner, feeRecipient } = await loadFixture(deployFixture);
      expect(await pay.owner()).to.equal(owner.address);
      expect(await pay.feeRecipient()).to.equal(feeRecipient.address);
      expect(await pay.feeBps()).to.equal(FEE_BPS);
    });

    it('rejects a fee above MAX_FEE_BPS', async function () {
      const { pay, feeRecipient } = await loadFixture(deployFixture);
      const Factory = await ethers.getContractFactory('PayWithQuai');
      await expect(Factory.deploy(feeRecipient.address, 501)).to.be.revertedWithCustomError(
        pay,
        'FeeTooHigh',
      );
    });

    it('rejects a zero fee recipient', async function () {
      const { pay } = await loadFixture(deployFixture);
      const Factory = await ethers.getContractFactory('PayWithQuai');
      await expect(Factory.deploy(ethers.ZeroAddress, 0)).to.be.revertedWithCustomError(
        pay,
        'ZeroFeeRecipient',
      );
    });
  });

  describe('registerOrder', function () {
    it('stores the order and emits OrderRegistered', async function () {
      const { pay, merchant, token } = await loadFixture(deployFixture);
      await expect(pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY))
        .to.emit(pay, 'OrderRegistered')
        .withArgs(merchant.address, oid('ord_1'), await token.getAddress(), AMOUNT, NO_EXPIRY, FEE_BPS);

      const order = await pay.getOrder(merchant.address, oid('ord_1'));
      expect(order.merchant).to.equal(merchant.address);
      expect(order.token).to.equal(await token.getAddress());
      expect(order.amount).to.equal(AMOUNT);
      expect(order.settled).to.equal(false);
      expect(order.exists).to.equal(true);
      expect(order.feeBps).to.equal(FEE_BPS);
    });

    it('reverts on a zero amount', async function () {
      const { pay, merchant, token } = await loadFixture(deployFixture);
      await expect(
        pay.connect(merchant).registerOrder(oid('ord_1'), token, 0, NO_EXPIRY),
      ).to.be.revertedWithCustomError(pay, 'ZeroAmount');
    });

    it('reverts for a token that is not accepted', async function () {
      const { pay, merchant, other } = await loadFixture(deployFixture);
      await expect(
        pay.connect(merchant).registerOrder(oid('ord_1'), other.address, AMOUNT, NO_EXPIRY),
      ).to.be.revertedWithCustomError(pay, 'TokenNotAccepted');
    });

    it('reverts for an expiry in the past', async function () {
      const { pay, merchant, token } = await loadFixture(deployFixture);
      await expect(
        pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, 1),
      ).to.be.revertedWithCustomError(pay, 'InvalidExpiry');
    });

    it('reverts when the same merchant reuses an order id', async function () {
      const { pay, merchant, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      await expect(
        pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY),
      ).to.be.revertedWithCustomError(pay, 'OrderAlreadyExists');
    });

    it('lets different merchants use the same order id (keyed by merchant)', async function () {
      const { pay, merchant, other, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      await expect(pay.connect(other).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY)).to.not.be
        .reverted;
    });

    it('reverts when paused', async function () {
      const { pay, owner, merchant, token } = await loadFixture(deployFixture);
      await pay.connect(owner).pause();
      await expect(
        pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY),
      ).to.be.revertedWithCustomError(pay, 'EnforcedPause');
    });
  });

  describe('cancelOrder', function () {
    it('lets the merchant cancel an unpaid order', async function () {
      const { pay, merchant, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      await expect(pay.connect(merchant).cancelOrder(oid('ord_1')))
        .to.emit(pay, 'OrderCancelled')
        .withArgs(merchant.address, oid('ord_1'));

      const order = await pay.getOrder(merchant.address, oid('ord_1'));
      expect(order.exists).to.equal(false);
    });

    it('frees the order id for re-registration after cancel', async function () {
      const { pay, merchant, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      await pay.connect(merchant).cancelOrder(oid('ord_1'));
      await expect(pay.connect(merchant).registerOrder(oid('ord_1'), token, usdq(10), NO_EXPIRY)).to.not
        .be.reverted;
    });

    it('reverts cancelling an unknown order (and cannot cancel another merchant order)', async function () {
      const { pay, merchant, other, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      // `other` targets its own (empty) (other, ord_1) key, so it cannot touch merchant's order.
      await expect(pay.connect(other).cancelOrder(oid('ord_1'))).to.be.revertedWithCustomError(
        pay,
        'OrderNotFound',
      );
    });

    it('reverts cancelling a settled order', async function () {
      const { pay, merchant, payer, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      await token.connect(payer).approve(pay, AMOUNT);
      await pay.connect(payer).payOrder(merchant.address, oid('ord_1'));
      await expect(pay.connect(merchant).cancelOrder(oid('ord_1'))).to.be.revertedWithCustomError(
        pay,
        'OrderAlreadySettled',
      );
    });
  });

  describe('payOrder (ERC-20)', function () {
    async function registeredFixture() {
      const base = await deployFixture();
      await base.pay.connect(base.merchant).registerOrder(oid('ord_1'), base.token, AMOUNT, NO_EXPIRY);
      await base.token.connect(base.payer).approve(base.pay, AMOUNT);
      return base;
    }

    it('splits fee and net, marks settled, and emits PaymentReceived', async function () {
      const { pay, merchant, payer, feeRecipient, token } = await loadFixture(registeredFixture);
      const { fee, net } = expectedSplit(AMOUNT, FEE_BPS);

      await expect(pay.connect(payer).payOrder(merchant.address, oid('ord_1')))
        .to.emit(pay, 'PaymentReceived')
        .withArgs(merchant.address, oid('ord_1'), payer.address, await token.getAddress(), AMOUNT, anyValue)
        .and.to.emit(pay, 'FeePaid')
        .withArgs(oid('ord_1'), await token.getAddress(), fee, feeRecipient.address);

      expect(await token.balanceOf(merchant.address)).to.equal(net);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(fee);
      expect(await pay.isSettled(merchant.address, oid('ord_1'))).to.equal(true);
    });

    it('moves exactly the registered amount from the payer', async function () {
      const { pay, merchant, payer, feeRecipient, token } = await loadFixture(registeredFixture);
      const { fee, net } = expectedSplit(AMOUNT, FEE_BPS);
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_1')),
      ).to.changeTokenBalances(token, [payer, merchant, feeRecipient], [-AMOUNT, net, fee]);
    });

    it('reverts for an unknown order', async function () {
      const { pay, merchant, payer } = await loadFixture(registeredFixture);
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_unknown')),
      ).to.be.revertedWithCustomError(pay, 'OrderNotFound');
    });

    it('reverts if the order is a native-QUAI order', async function () {
      const { pay, merchant, payer } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_native'), ethers.ZeroAddress, AMOUNT, NO_EXPIRY);
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_native')),
      ).to.be.revertedWithCustomError(pay, 'WrongPaymentPath');
    });

    it('reverts without sufficient allowance', async function () {
      const { pay, merchant, payer, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      // no approve
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_1')),
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientAllowance');
    });

    it('rejects a second payment for the same order (no double fulfillment)', async function () {
      const { pay, merchant, payer, token } = await loadFixture(registeredFixture);
      await pay.connect(payer).payOrder(merchant.address, oid('ord_1'));
      await token.connect(payer).approve(pay, AMOUNT); // even with fresh allowance
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_1')),
      ).to.be.revertedWithCustomError(pay, 'OrderAlreadySettled');
    });

    it('sends the full amount to the merchant when fee is zero', async function () {
      const { pay, merchant, payer, feeRecipient, token } = await loadFixture(deployZeroFeeFixture);
      await pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY);
      await token.connect(payer).approve(pay, AMOUNT);

      const tx = pay.connect(payer).payOrder(merchant.address, oid('ord_1'));
      await expect(tx).to.emit(pay, 'PaymentReceived');
      await expect(tx).to.not.emit(pay, 'FeePaid');
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(0);
    });

    it('reverts when paused', async function () {
      const { pay, owner, merchant, payer } = await loadFixture(registeredFixture);
      await pay.connect(owner).pause();
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_1')),
      ).to.be.revertedWithCustomError(pay, 'EnforcedPause');
    });
  });

  describe('payOrderNative', function () {
    async function nativeFixture() {
      const base = await deployFixture();
      await base.pay
        .connect(base.merchant)
        .registerOrder(oid('ord_n'), ethers.ZeroAddress, AMOUNT, NO_EXPIRY);
      return base;
    }

    it('emits PaymentReceived and marks the order settled', async function () {
      const { pay, merchant, payer } = await loadFixture(nativeFixture);

      await expect(pay.connect(payer).payOrderNative(merchant.address, oid('ord_n'), { value: AMOUNT }))
        .to.emit(pay, 'PaymentReceived')
        .withArgs(merchant.address, oid('ord_n'), payer.address, ethers.ZeroAddress, AMOUNT, anyValue);

      expect(await pay.isSettled(merchant.address, oid('ord_n'))).to.equal(true);
    });

    it('moves the correct native balances', async function () {
      const { pay, merchant, payer, feeRecipient } = await loadFixture(nativeFixture);
      const { fee, net } = expectedSplit(AMOUNT, FEE_BPS);
      await expect(
        pay.connect(payer).payOrderNative(merchant.address, oid('ord_n'), { value: AMOUNT }),
      ).to.changeEtherBalances([merchant, feeRecipient], [net, fee]);
    });

    it('reverts if msg.value does not equal the registered amount', async function () {
      const { pay, merchant, payer } = await loadFixture(nativeFixture);
      await expect(
        pay.connect(payer).payOrderNative(merchant.address, oid('ord_n'), { value: AMOUNT - 1n }),
      ).to.be.revertedWithCustomError(pay, 'IncorrectNativeValue');
    });

    it('reverts if the order is an ERC-20 order', async function () {
      const { pay, merchant, payer, token } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_erc'), token, AMOUNT, NO_EXPIRY);
      await expect(
        pay.connect(payer).payOrderNative(merchant.address, oid('ord_erc'), { value: AMOUNT }),
      ).to.be.revertedWithCustomError(pay, 'WrongPaymentPath');
    });

    it('rejects a second native payment for the same order', async function () {
      const { pay, merchant, payer } = await loadFixture(nativeFixture);
      await pay.connect(payer).payOrderNative(merchant.address, oid('ord_n'), { value: AMOUNT });
      await expect(
        pay.connect(payer).payOrderNative(merchant.address, oid('ord_n'), { value: AMOUNT }),
      ).to.be.revertedWithCustomError(pay, 'OrderAlreadySettled');
    });

    it('reverts on a direct native transfer to the contract', async function () {
      const { pay, payer } = await loadFixture(deployFixture);
      await expect(payer.sendTransaction({ to: await pay.getAddress(), value: 1n })).to.be.reverted;
    });
  });

  describe('order expiry', function () {
    it('allows payment before expiry', async function () {
      const { pay, merchant, payer, token } = await loadFixture(deployFixture);
      const expiry = (await time.latest()) + 3600;
      await pay.connect(merchant).registerOrder(oid('ord_exp'), token, AMOUNT, expiry);
      await token.connect(payer).approve(pay, AMOUNT);
      await expect(pay.connect(payer).payOrder(merchant.address, oid('ord_exp'))).to.emit(
        pay,
        'PaymentReceived',
      );
    });

    it('rejects payment after expiry', async function () {
      const { pay, merchant, payer, token } = await loadFixture(deployFixture);
      const expiry = (await time.latest()) + 3600;
      await pay.connect(merchant).registerOrder(oid('ord_exp'), token, AMOUNT, expiry);
      await token.connect(payer).approve(pay, AMOUNT);
      await time.increaseTo(expiry + 1);
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_exp')),
      ).to.be.revertedWithCustomError(pay, 'OrderExpired');
    });
  });

  describe('fee locked at registration', function () {
    it('honors the fee at registration time, not a later fee change (ERC-20)', async function () {
      const { pay, owner, merchant, payer, feeRecipient, token } = await loadFixture(deployFixture);
      // Registered at 0.5%.
      await pay.connect(merchant).registerOrder(oid('ord_lock'), token, AMOUNT, NO_EXPIRY);
      // Owner bumps the platform fee to the 5% cap before the customer pays.
      await pay.connect(owner).setFeeConfig(500, feeRecipient.address);
      await token.connect(payer).approve(pay, AMOUNT);

      // The merchant still nets the amount minus the *locked* 0.5% — not the new 5%.
      const { fee, net } = expectedSplit(AMOUNT, FEE_BPS);
      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_lock')),
      ).to.changeTokenBalances(token, [payer, merchant, feeRecipient], [-AMOUNT, net, fee]);
    });

    it('honors the fee at registration time for native orders', async function () {
      const { pay, owner, merchant, payer, feeRecipient } = await loadFixture(deployFixture);
      await pay.connect(merchant).registerOrder(oid('ord_lock_n'), ethers.ZeroAddress, AMOUNT, NO_EXPIRY);
      await pay.connect(owner).setFeeConfig(500, feeRecipient.address);

      const { fee, net } = expectedSplit(AMOUNT, FEE_BPS);
      await expect(
        pay.connect(payer).payOrderNative(merchant.address, oid('ord_lock_n'), { value: AMOUNT }),
      ).to.changeEtherBalances([merchant, feeRecipient], [net, fee]);
    });

    it('applies a later fee reduction only to orders registered afterwards', async function () {
      const { pay, owner, merchant, payer, feeRecipient, token } = await loadFixture(deployFixture);
      // Old order keeps 0.5%.
      await pay.connect(merchant).registerOrder(oid('ord_old'), token, AMOUNT, NO_EXPIRY);
      // Owner drops the fee to 0; new order locks in 0.
      await pay.connect(owner).setFeeConfig(0, feeRecipient.address);
      await pay.connect(merchant).registerOrder(oid('ord_new'), token, AMOUNT, NO_EXPIRY);

      expect((await pay.getOrder(merchant.address, oid('ord_old'))).feeBps).to.equal(FEE_BPS);
      expect((await pay.getOrder(merchant.address, oid('ord_new'))).feeBps).to.equal(0n);
    });
  });

  describe('rescueTokens', function () {
    it('lets the owner sweep stray ERC-20 sent directly to the contract', async function () {
      const { pay, owner, other, token } = await loadFixture(deployFixture);
      const stray = usdq(7);
      await token.mint(await pay.getAddress(), stray); // funds arrive outside the payment flow

      await expect(pay.connect(owner).rescueTokens(await token.getAddress(), other.address, stray))
        .to.emit(pay, 'TokensRescued')
        .withArgs(await token.getAddress(), other.address, stray);
      expect(await token.balanceOf(other.address)).to.equal(stray);
      expect(await token.balanceOf(await pay.getAddress())).to.equal(0);
    });

    it('rejects rescue from a non-owner', async function () {
      const { pay, other, token } = await loadFixture(deployFixture);
      await expect(
        pay.connect(other).rescueTokens(await token.getAddress(), other.address, 1),
      ).to.be.revertedWithCustomError(pay, 'OwnableUnauthorizedAccount');
    });

    it('rejects a zero destination', async function () {
      const { pay, owner, token } = await loadFixture(deployFixture);
      await expect(
        pay.connect(owner).rescueTokens(await token.getAddress(), ethers.ZeroAddress, 1),
      ).to.be.revertedWithCustomError(pay, 'ZeroAddress');
    });
  });

  describe('admin', function () {
    it('lets the owner update the fee config', async function () {
      const { pay, owner, other } = await loadFixture(deployFixture);
      await expect(pay.connect(owner).setFeeConfig(100, other.address))
        .to.emit(pay, 'FeeConfigUpdated')
        .withArgs(100, other.address);
      expect(await pay.feeBps()).to.equal(100);
      expect(await pay.feeRecipient()).to.equal(other.address);
    });

    it('caps the fee at MAX_FEE_BPS', async function () {
      const { pay, owner, other } = await loadFixture(deployFixture);
      await expect(
        pay.connect(owner).setFeeConfig(501, other.address),
      ).to.be.revertedWithCustomError(pay, 'FeeTooHigh');
    });

    it('rejects a zero fee recipient', async function () {
      const { pay, owner } = await loadFixture(deployFixture);
      await expect(
        pay.connect(owner).setFeeConfig(100, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(pay, 'ZeroFeeRecipient');
    });

    it('rejects fee changes from non-owners', async function () {
      const { pay, other } = await loadFixture(deployFixture);
      await expect(
        pay.connect(other).setFeeConfig(100, other.address),
      ).to.be.revertedWithCustomError(pay, 'OwnableUnauthorizedAccount');
    });

    it('lets the owner manage the accepted-token allowlist', async function () {
      const { pay, owner, other } = await loadFixture(deployFixture);
      expect(await pay.isTokenAccepted(other.address)).to.equal(false);
      await expect(pay.connect(owner).setTokenAccepted(other.address, true))
        .to.emit(pay, 'AcceptedTokenUpdated')
        .withArgs(other.address, true);
      expect(await pay.isTokenAccepted(other.address)).to.equal(true);
    });

    it('rejects allowlist changes from non-owners', async function () {
      const { pay, other } = await loadFixture(deployFixture);
      await expect(
        pay.connect(other).setTokenAccepted(other.address, true),
      ).to.be.revertedWithCustomError(pay, 'OwnableUnauthorizedAccount');
    });

    it('rejects pause from non-owners', async function () {
      const { pay, other } = await loadFixture(deployFixture);
      await expect(pay.connect(other).pause()).to.be.revertedWithCustomError(
        pay,
        'OwnableUnauthorizedAccount',
      );
    });

    it('unpause restores payments', async function () {
      const { pay, owner, merchant, token } = await loadFixture(deployFixture);
      await pay.connect(owner).pause();
      await pay.connect(owner).unpause();
      await expect(pay.connect(merchant).registerOrder(oid('ord_1'), token, AMOUNT, NO_EXPIRY)).to.not
        .be.reverted;
    });
  });

  describe('ownership (Ownable2Step)', function () {
    it('transfers ownership in two steps', async function () {
      const { pay, owner, other } = await loadFixture(deployFixture);
      await pay.connect(owner).transferOwnership(other.address);
      // Ownership does not move until accepted.
      expect(await pay.owner()).to.equal(owner.address);
      expect(await pay.pendingOwner()).to.equal(other.address);

      await pay.connect(other).acceptOwnership();
      expect(await pay.owner()).to.equal(other.address);
    });

    it('rejects acceptance from a non-pending account', async function () {
      const { pay, owner, other } = await loadFixture(deployFixture);
      await pay.connect(owner).transferOwnership(other.address);
      await expect(pay.connect(owner).acceptOwnership()).to.be.revertedWithCustomError(
        pay,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('reentrancy', function () {
    it('blocks re-entry through a malicious ERC-20', async function () {
      const { pay, owner, merchant, payer } = await loadFixture(deployFixture);
      const evil = await ethers.deployContract('ReentrantToken');
      await evil.mint(payer.address, AMOUNT);
      await pay.connect(owner).setTokenAccepted(await evil.getAddress(), true);
      await pay.connect(merchant).registerOrder(oid('ord_re'), evil, AMOUNT, NO_EXPIRY);
      await evil.connect(payer).approve(pay, AMOUNT);
      await evil.arm(await pay.getAddress(), merchant.address, oid('ord_re'));

      await expect(
        pay.connect(payer).payOrder(merchant.address, oid('ord_re')),
      ).to.be.revertedWithCustomError(pay, 'ReentrancyGuardReentrantCall');
    });

    it('blocks re-entry through a malicious native receiver', async function () {
      const { pay, payer } = await loadFixture(deployFixture);
      const evil = await ethers.deployContract('ReentrantReceiver', [await pay.getAddress()]);
      await evil.register(oid('ord_re2'), AMOUNT); // evil contract is the merchant

      // The re-entrant receive() makes the payout call fail -> whole payment reverts, funds safe.
      await expect(
        pay.connect(payer).payOrderNative(await evil.getAddress(), oid('ord_re2'), { value: AMOUNT }),
      ).to.be.revertedWithCustomError(pay, 'NativeTransferFailed');
    });
  });
});
