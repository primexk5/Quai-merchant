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
      src="/logo.jpeg"
      alt="QUAIMerchant logo"
      width={1024}
      height={1024}
      priority={priority}
      className={`rounded-lg object-cover ${className}`}
    />
  );
}