import { GoogleIdButton } from './_google-button'

export function SignInForm({ next }: { next: string }) {
  return (
    <div className="flex w-full flex-col gap-6">
      <GoogleIdButton next={next} />
    </div>
  )
}
