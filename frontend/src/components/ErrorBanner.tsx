type Props = {
  title?: string
  message: string
}

export function ErrorBanner({ title = 'Something went wrong', message }: Props) {
  return (
    <div className="errorBanner" role="alert">
      <div className="errorBannerTitle">{title}</div>
      <div className="errorBannerMessage">{message}</div>
    </div>
  )
}

