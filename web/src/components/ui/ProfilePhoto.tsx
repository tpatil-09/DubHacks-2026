import { isPastel, pastel } from '../../lib/colors'

interface ProfilePhotoProps {
  src: string | undefined
  alt: string
  className?: string
  emojiSize?: string
}

/** Renders an uploaded photo, or a generated pastel avatar for `avatar:<emoji>:<color>`. */
export function ProfilePhoto({ src, alt, className = '', emojiSize = 'text-7xl' }: ProfilePhotoProps) {
  if (src && !src.startsWith('avatar:')) {
    return <img src={src} alt={alt} className={`object-cover ${className}`} draggable={false} />
  }
  const [, emoji = '💖', colorName = 'blush'] = (src ?? '').split(':')
  const color = isPastel(colorName) ? pastel[colorName] : pastel.blush
  return (
    <div
      role="img"
      aria-label={alt}
      className={`grid place-items-center ${className}`}
      style={{ background: `radial-gradient(circle at 30% 25%, #fff 0%, ${color.soft} 30%, ${color.bg} 100%)` }}
    >
      <span className={`${emojiSize} drop-shadow-[0_6px_6px_rgba(35,26,27,.18)]`} aria-hidden>
        {emoji}
      </span>
    </div>
  )
}

export function Avatar({ src, alt, size = 48 }: { src: string | undefined; alt: string; size?: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-full ring-2 ring-white" style={{ width: size, height: size }}>
      <ProfilePhoto src={src} alt={alt} className="h-full w-full" emojiSize={size > 56 ? 'text-3xl' : 'text-xl'} />
    </div>
  )
}
