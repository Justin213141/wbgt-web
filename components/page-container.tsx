import type { ReactNode } from "react"

interface PageContainerProps {
  children: ReactNode
  title: string
  description?: string
}

export function PageContainer({ children, title, description }: PageContainerProps) {
  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-8 lg:pl-64">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          {description && <p className="mt-2 text-pretty text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
