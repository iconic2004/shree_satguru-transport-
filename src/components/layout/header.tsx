'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/use-user'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { formatDate } from '@/lib/utils/formatting'
import {
  Bell,
  Search,
  LogOut,
  User,
  Moon,
  Sun,
  Globe,
  ChevronDown,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const router = useRouter()
  const { user, profile } = useUser()
  const [darkMode, setDarkMode] = useState(false)
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en')

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'ST'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const todayDate = formatDate(new Date())

  return (
    <header className="h-16 border-b bg-white dark:bg-gray-950 flex items-center justify-between px-4 lg:px-6 z-20 shadow-sm">
      {/* Search Input */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search goods, invoice no, vehicle, driver..."
            className="pl-9 h-9 bg-gray-50 border-gray-200 text-xs dark:bg-gray-900 dark:border-gray-800 focus:bg-white"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Current Date & IST Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-medium text-gray-700 dark:text-gray-300">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          <span>{todayDate} (IST)</span>
        </div>

        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 px-2.5 text-xs gap-1.5">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline font-medium uppercase">{language}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Display Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLanguage('en')} className="cursor-pointer">
              English {language === 'en' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('hi')} className="cursor-pointer">
              हिन्दी (Hindi) {language === 'hi' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('mr')} className="cursor-pointer">
              मराठी (Marathi) {language === 'mr' && '✓'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dark Mode Toggle */}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white"
          onClick={() => router.push('/notifications')}
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        </Button>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2.5 pl-2 pr-2.5 h-10 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg">
              <Avatar className="w-8 h-8 border border-navy-200 dark:border-navy-800">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-navy-800 text-white text-xs font-bold">
                  {getInitials(profile?.full_name || 'Admin User')}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {profile?.full_name || 'Admin Officer'}
                </span>
                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold leading-tight">
                  {profile?.role ? ROLE_LABELS[profile.role] : 'Super Admin'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 hidden md:block text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-semibold">{profile?.full_name || 'Admin User'}</span>
                <span className="text-xs text-gray-500 font-normal">{user?.email || 'admin@satgurutransport.com'}</span>
                <Badge variant="outline" className="w-fit mt-1 text-[10px] bg-navy-50 text-navy-800 border-navy-200">
                  {profile?.role ? ROLE_LABELS[profile.role] : 'Super Admin'}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
              <User className="w-4 h-4 mr-2 text-gray-500" />
              Profile & Security
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/notifications')} className="cursor-pointer">
              <Bell className="w-4 h-4 mr-2 text-gray-500" />
              Notifications & Alerts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
