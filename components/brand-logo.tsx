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
      <span className={className}>
        <Image
          src="/brand/logo-mark.png"
          alt="Gestão Fácil"
          width={84}
          height={84}
          priority={priority}
          className="brand-logo-image"
        />
      </span>
    );
  }

  return (
    <span className={className}>
      <Image
        src="/brand/logo-wordmark.png"
        alt="Gestão Fácil Sistemas"
        width={1080}
        height={326}
        priority={priority}
        className="brand-logo-image brand-logo-image-wordmark"
      />
    </span>
  );
}
