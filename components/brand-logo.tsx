import Image from "next/image";

type BrandLogoProps = {
  variant?: "wordmark" | "mark";
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "wordmark",
  className,
  priority = false,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/logo-mark.png"
        alt="Gestao Facil"
        width={84}
        height={84}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <Image
      src="/brand/logo-wordmark.png"
      alt="Gestao Facil Sistemas"
      width={485}
      height={123}
      priority={priority}
      className={className}
    />
  );
}
