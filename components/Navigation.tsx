'use client'

import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const { userProfile, isAdmin, isDriver, isMaintenanceProvider } = useAuth()
  const pathname = usePathname()

  if (!userProfile) return null

  const getNavItems = () => {
    if (isAdmin) {
      return [
        { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
        { name: 'Vehicles', href: '/vehicles', icon: '🚛' },
        { name: 'Inspections', href: '/inspections', icon: '🔍' },
        { name: 'Users', href: '/admin/users', icon: '👥' },
        { name: 'Orders', href: '/orders', icon: '📦' },
        { name: 'Reports', href: '/reports', icon: '📊' },
      ]
    } else if (isDriver) {
      return [
        { name: 'Dashboard', href: '/driver', icon: '🏠' },
        { name: 'My Hours', href: '/driver/hours', icon: '⏰' },
        { name: 'Vehicle Checks', href: '/driver/checks', icon: '✅' },
        { name: 'Documents', href: '/driver/documents', icon: '📄' },
        { name: 'Accident Report', href: '/driver/accident', icon: '🚨' },
      ]
    } else if (isMaintenanceProvider) {
      return [
        { name: 'Dashboard', href: '/maintenance', icon: '🏠' },
        { name: 'Vehicles', href: '/maintenance/vehicles', icon: '🚛' },
        { name: 'Inspections', href: '/maintenance/inspections', icon: '🔍' },
        { name: 'Work Orders', href: '/maintenance/work-orders', icon: '🔧' },
      ]
    }
    return []
  }

  const navItems = getNavItems()

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">HGV Management</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === item.href
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {userProfile.email}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  userProfile.role === 'admin' ? 'bg-red-100 text-red-800' :
                  userProfile.role === 'driver' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {userProfile.role.replace('_', ' ').toUpperCase()}
                </span>
                <button
                  onClick={async () => {
                    if (supabase) {
                      await supabase.auth.signOut()
                    }
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
