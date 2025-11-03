"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock, History, Calendar, CalendarDays, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/now", label: "Now", icon: Clock },
  { href: "/recent", label: "Recent", icon: History },
  { href: "/tomorrow", label: "Tomorrow", icon: Calendar },
  { href: "/weekend", label: "Weekend", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:p-6">
        <div className="mb-8">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground">WBGT Dashboard</h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">Heat stress monitoring</p>
        </div>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
