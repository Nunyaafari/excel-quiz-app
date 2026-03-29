type StarRatingProps = {
  rating: number
  max?: number
  sizeClassName?: string
  labelClassName?: string
}

export default function StarRating({
  rating,
  max = 5,
  sizeClassName = 'text-base',
  labelClassName = 'text-xs text-[#5f7390]',
}: StarRatingProps) {
  const safeRating = Math.max(0, Math.min(max, Math.round(rating)))
  const stars = Array.from({ length: max }, (_, index) => index < safeRating)

  return (
    <div className="flex items-center gap-2" aria-label={`${safeRating} out of ${max} stars`}>
      <div className={`flex items-center gap-0.5 ${sizeClassName}`} aria-hidden="true">
        {stars.map((filled, index) => (
          <span key={index} className={filled ? 'text-amber-400' : 'text-[#c5d2e3]'}>
            ★
          </span>
        ))}
      </div>
      <span className={labelClassName}>{safeRating} of 5</span>
    </div>
  )
}
