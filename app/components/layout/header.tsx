import { SignButton } from "@/components/auth/sign-button"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { NavLinks } from "@/components/layout/nav-links"
import { Logo } from "@/components/ui/logo"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto h-full px-4">
        <div className="h-full flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 lg:gap-6">
            <Logo />
            <NavLinks />
          </div>
          <div className="flex items-center gap-y-4 gap-x-3 sm:gap-x-4">
            <LanguageSwitcher />
            <ThemeToggle />
            <SignButton />
          </div>
        </div>
      </div>
    </header>
  )
} 