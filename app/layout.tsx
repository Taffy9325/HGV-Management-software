import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import ConditionalNavigation from '@/components/ConditionalNavigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'HGV Compliance Platform',
  description: 'Comprehensive HGV route planning, dispatch, maintenance, and DVSA compliance management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            <ConditionalNavigation />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}

