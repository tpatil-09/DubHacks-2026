import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { pastel, type PastelColor } from '../../lib/colors'

interface ArcadeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: PastelColor
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: ReactNode
}

const sizes = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-base',
  lg: 'h-14 px-8 text-lg',
  icon: 'h-14 w-14 text-xl',
}

export function ArcadeButton({
  color = 'bubblegum',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  style,
  ...rest
}: ArcadeButtonProps) {
  const vars = { '--btn-bg': pastel[color].bg, '--btn-text': pastel[color].text, ...style } as CSSProperties
  return (
    <button
      type={type}
      className={`btn-arcade ${sizes[size]} ${color === 'white' ? 'ring-1 ring-[var(--color-line)]' : ''} ${className}`}
      style={vars}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
