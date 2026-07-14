interface AvatarProps {
  avatarUrl: string;
  displayName: string;
  size?: number;
}

export default function Avatar({ avatarUrl, displayName, size = 40 }: AvatarProps) {
  return (
    <img
      src={avatarUrl}
      alt={displayName}
      width={size}
      height={size}
      className="rounded-full object-cover bg-surface-modifier"
      style={{ width: size, height: size }}
    />
  );
}
