import Image from "next/image";

export function Logo({
  className = "h-8 w-8",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/new_logo.png"
      alt="QUAIMerchant logo"
      width={512}
      height={512}
      priority={priority}
      className={`rounded-lg object-cover ${className}`}
    />
  );
}