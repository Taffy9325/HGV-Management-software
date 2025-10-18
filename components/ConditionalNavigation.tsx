'use client'

import { useAuth } from '@/components/AuthProvider'
import { usePathname } from 'next/navigation'
import Navigation from './Navigation'

export default function ConditionalNavigation() {
  const { userProfile } = useAuth()
  const pathname = usePathname()

  // Public pages that should not show navigation
  const publicPages = [
    '/',
    '/auth/login',
    '/auth/register',
    '/auth/invited-signup',
    '/auth/callback'
  ]

  // Don't show navigation on public pages or if user is not authenticated
  if (publicPages.includes(pathname) || !userProfile) {
    return null
  }

  // Show navigation for authenticated users on protected pages
  return <Navigation />
}
