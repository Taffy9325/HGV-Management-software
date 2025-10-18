'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Tables } from '@/lib/supabase'

interface UserProfile extends Tables<'users'> {
  driver?: Tables<'drivers'> | null
  maintenance_provider?: Tables<'maintenance_providers'> | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  isDriver: boolean
  isMaintenanceProvider: boolean
  isSuperUser: boolean
  tenantId: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  isDriver: false,
  isMaintenanceProvider: false,
  isSuperUser: false,
  tenantId: null,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (userId: string) => {
    if (!supabase) return null

    try {
      // Fetch user profile with role and tenant info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('Error fetching user profile:', userError)
        return null
      }

      let profile: UserProfile = userData

      // Fetch additional role-specific data
      if (userData.role === 'driver') {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        profile.driver = driverData || null
      } else if (userData.role === 'maintenance_provider') {
        const { data: maintenanceData } = await supabase
          .from('maintenance_providers')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        profile.maintenance_provider = maintenanceData || null
      }

      return profile
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }

  useEffect(() => {
    // Skip auth if Supabase is not configured
    if (!supabase) {
      console.warn('Supabase client is not configured. Authentication will not work.')
      setLoading(false)
      return
    }

    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id)
          setUserProfile(profile)
        } else {
          setUserProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = userProfile?.role === 'admin'
  const isDriver = userProfile?.role === 'driver'
  const isMaintenanceProvider = userProfile?.role === 'maintenance_provider'
  const isSuperUser = userProfile?.role === 'super_user'
  const tenantId = userProfile?.tenant_id || null

  const value = {
    user,
    session,
    userProfile,
    loading,
    isAdmin,
    isDriver,
    isMaintenanceProvider,
    isSuperUser,
    tenantId,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}


