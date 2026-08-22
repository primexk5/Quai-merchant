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
      src="/new-logo.png"
      alt="TripplePay || Marchants logo"
      width={512}
      height={512}
      priority={priority}
      className={`rounded-lg object-cover ${className}`}
    />
  );
}