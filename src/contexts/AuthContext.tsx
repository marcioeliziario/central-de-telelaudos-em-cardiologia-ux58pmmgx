import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { AuthUser, UserOrganization, UserRole, Organization } from '@/types/telelaudos'

interface AuthContextType {
  user: AuthUser | null
  userOrgs: UserOrganization[]
  currentOrg: Organization | null
  currentRole: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  switchOrg: (orgId: string) => void
  requestPasswordReset: (email: string) => Promise<{ success: boolean; note?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshProfile = async () => {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      setUser(null)
      setUserOrgs([])
      setCurrentOrg(null)
      setCurrentRole(null)
      setIsLoading(false)
      return
    }

    try {
      const u = pb.authStore.record as unknown as AuthUser
      setUser(u)

      const orgLinks = await pb.collection('user_organizations').getFullList<UserOrganization>({
        filter: `user_id = '${u.id}' && is_active = true`,
        expand: 'organization_id',
      })

      setUserOrgs(orgLinks)

      if (orgLinks.length > 0) {
        // Selecionar primeira organização ativa ou manter se já selecionada
        const savedOrgId = localStorage.getItem('telelaudos_current_org_id')
        const found = orgLinks.find((l) => l.organization_id === savedOrgId) || orgLinks[0]
        setCurrentRole(found.role)
        if (found.expand?.organization_id) {
          setCurrentOrg(found.expand.organization_id)
        }
      } else {
        // Usuário sem organização vinculada (ex: auto-registro inicial)
        setCurrentRole(null)
        setCurrentOrg(null)
      }
    } catch (err) {
      console.error('Erro ao carregar perfil do usuário:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshProfile()
    return pb.authStore.onChange(() => {
      refreshProfile()
    })
  }, [])

  const login = async (email: string, pass: string) => {
    setIsLoading(true)
    try {
      await pb.collection('users').authWithPassword(email, pass)
      await refreshProfile()
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setUserOrgs([])
    setCurrentOrg(null)
    setCurrentRole(null)
    localStorage.removeItem('telelaudos_current_org_id')
  }

  const switchOrg = (orgId: string) => {
    const link = userOrgs.find((l) => l.organization_id === orgId)
    if (link) {
      setCurrentRole(link.role)
      if (link.expand?.organization_id) {
        setCurrentOrg(link.expand.organization_id)
      }
      localStorage.setItem('telelaudos_current_org_id', orgId)
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email)
      return { success: true }
    } catch (err: any) {
      return {
        success: false,
        note: err.message || 'Servidor SMTP de envio não configurado ou e-mail inválido.',
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userOrgs,
        currentOrg,
        currentRole,
        isAuthenticated: !!user && pb.authStore.isValid,
        isLoading,
        login,
        logout,
        switchOrg,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
