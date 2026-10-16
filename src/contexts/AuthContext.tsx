import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { AuthUser, UserOrganization, UserRole, Organization } from '@/types/telelaudos'

export type ActiveEnvironment = 'admin' | 'cardiologist' | 'clinic'

interface AuthContextType {
  user: AuthUser | null
  userOrgs: UserOrganization[]
  currentOrg: Organization | null
  currentRole: UserRole | null
  availableRoles: UserRole[]
  activeEnvironment: ActiveEnvironment
  canSwitchEnvironment: boolean
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  switchOrg: (orgId: string) => void
  switchEnvironment: (env: 'admin' | 'cardiologist') => void
  requestPasswordReset: (email: string) => Promise<{ success: boolean; note?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [activeEnvironment, setActiveEnvironment] = useState<ActiveEnvironment>('admin')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Lista de papéis ativos disponíveis para a conta autenticada
  const availableRoles = React.useMemo(() => {
    const set = new Set<UserRole>()
    userOrgs.forEach((uo) => {
      if (uo.is_active !== false) {
        set.add(uo.role)
      }
    })
    return Array.from(set)
  }, [userOrgs])

  // O Dr. Márcio (ou qualquer usuário com ambos os papéis) pode alternar
  const canSwitchEnvironment =
    availableRoles.includes('admin') && availableRoles.includes('cardiologist')

  const refreshProfile = async () => {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      setUser(null)
      setUserOrgs([])
      setCurrentOrg(null)
      setCurrentRole(null)
      setActiveEnvironment('admin')
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
        const rolesInOrgs = Array.from(new Set(orgLinks.map((l) => l.role)))

        // Determinar ambiente ativo salvo ou prioritário
        const savedEnv = localStorage.getItem(
          'telelaudos_active_environment',
        ) as ActiveEnvironment | null
        let resolvedEnv: ActiveEnvironment = 'admin'

        if (rolesInOrgs.includes('admin') && rolesInOrgs.includes('cardiologist')) {
          if (savedEnv === 'cardiologist' || savedEnv === 'admin') {
            resolvedEnv = savedEnv
          } else {
            resolvedEnv = 'admin' // Padrão prioritário para admin
          }
        } else if (rolesInOrgs.includes('admin')) {
          resolvedEnv = 'admin'
        } else if (rolesInOrgs.includes('cardiologist')) {
          resolvedEnv = 'cardiologist'
        } else if (
          rolesInOrgs.includes('clinic_manager') ||
          rolesInOrgs.includes('clinic_operator')
        ) {
          resolvedEnv = 'clinic'
        } else {
          resolvedEnv = 'admin'
        }

        setActiveEnvironment(resolvedEnv)

        // Selecionar vínculo correspondente ao ambiente ativo
        let matchingLink = orgLinks.find((l) => l.role === (resolvedEnv as unknown as UserRole))
        if (!matchingLink) {
          const savedOrgId = localStorage.getItem('telelaudos_current_org_id')
          matchingLink = orgLinks.find((l) => l.organization_id === savedOrgId) || orgLinks[0]
        }

        setCurrentRole(matchingLink.role)
        if (matchingLink.expand?.organization_id) {
          setCurrentOrg(matchingLink.expand.organization_id)
        }
      } else {
        // Usuário sem organização vinculada
        setCurrentRole(null)
        setCurrentOrg(null)
        setActiveEnvironment('admin')
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
    setActiveEnvironment('admin')
    localStorage.removeItem('telelaudos_current_org_id')
    localStorage.removeItem('telelaudos_active_environment')
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

  // Alternar ambiente instantaneamente (sem logout) para usuários com múltiplos papéis
  const switchEnvironment = (env: 'admin' | 'cardiologist') => {
    if (!availableRoles.includes(env)) {
      console.warn(`Ambiente ${env} não autorizado para este usuário.`)
      return
    }

    setActiveEnvironment(env)
    localStorage.setItem('telelaudos_active_environment', env)

    // Ajustar o vínculo e papel ativo
    const link = userOrgs.find((l) => l.role === env)
    if (link) {
      setCurrentRole(link.role)
      if (link.expand?.organization_id) {
        setCurrentOrg(link.expand.organization_id)
      }
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
        availableRoles,
        activeEnvironment,
        canSwitchEnvironment,
        isAuthenticated: !!user && pb.authStore.isValid,
        isLoading,
        login,
        logout,
        switchOrg,
        switchEnvironment,
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
