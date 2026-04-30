import Link from 'next/link'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/server/actions/auth'

type TopBarUser = {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

function initials(input: string) {
  const parts = input.split(/[\s@.]+/).filter(Boolean)
  return (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')
}

export function TopBar({ user }: { user: TopBarUser }) {
  const display = user.fullName || user.email.split('@')[0]

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          Landingcheck
        </Link>
        <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
          <Link className="hover:text-foreground" href="/dashboard">
            Dashboard
          </Link>
          <Link className="hover:text-foreground" href="/audits">
            Audits
          </Link>
          <Link className="hover:text-foreground" href="/billing">
            Billing
          </Link>
        </nav>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2 px-2" />}>
          <Avatar className="size-7">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={display} /> : null}
            <AvatarFallback className="text-xs">
              {initials(display).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm sm:inline">{display}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-medium">{display}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/billing" />}>Billing</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="p-0">
              <form action={signOut} className="contents">
                <button type="submit" className="w-full px-2 py-1.5 text-left">
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
