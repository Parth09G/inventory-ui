export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-danger"
    >
      {message}
    </p>
  )
}
