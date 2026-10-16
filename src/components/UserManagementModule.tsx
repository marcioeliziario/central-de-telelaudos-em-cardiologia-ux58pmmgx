import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RotateCcw,
  MoreVertical,
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  Stethoscope,
  Building2,
  AlertTriangle,
  Lock,
  Unlock,
  Mail,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminUserService, CreateUserInput, UpdateUserInput } from '@/services/telelaudosService'
import { AdminManagedUserItem, Organization, UserRole } from '@/types/telelaudos'
import { useAuth } from '@/contexts/AuthContext'

interface UserManagementModuleProps {
  organizations: Organization[]
  onRefreshData?: () => void
}

export const UserManagementModule: React.FC<UserManagementModuleProps> = ({
  organizations,
  onRefreshData,
}) => {
  const { user: currentAuthUser } = useAuth()
  const [users, setUsers] = useState<AdminManagedUserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modais de Criação e Edição
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminManagedUserItem | null>(null)

  // Modais de Ações Críticas
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [temporaryPasswordResult, setTemporaryPasswordResult] = useState<string | null>(null)

  // Formulário de Cadastro
  const [createForm, setCreateForm] = useState<CreateUserInput>({
    name: '',
    email: '',
    password: '',
    phone: '',
    organization_id: organizations[0]?.id || '',
    role: 'clinic_operator',
    title_position: '',
    crm: '',
    crm_state: 'SP',
    rqe: '',
    specialty: 'Cardiologia Clínica e Eletrocardiografia',
  })

  // Formulário de Edição
  const [editForm, setEditForm] = useState<UpdateUserInput>({
    name: '',
    phone: '',
    password: '',
    crm: '',
    crm_state: 'SP',
    rqe: '',
    specialty: '',
  })

  // Formulário de Vínculo de Papel Adicional
  const [roleForm, setRoleForm] = useState<{
    action: 'assign' | 'revoke'
    organization_id: string
    role: UserRole
    title_position: string
  }>({
    action: 'assign',
    organization_id: organizations[0]?.id || '',
    role: 'clinic_operator',
    title_position: '',
  })

  const [actionLoading, setActionLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const isCurrentPrimaryAdmin =
    currentAuthUser?.email === 'marcio.eliziario@hotmail.com' ||
    (currentAuthUser as any)?.is_primary_admin === true

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await adminUserService.listUsers({
        name: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        organization_id: orgFilter !== 'all' ? orgFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      if (res.success && res.users) {
        setUsers(res.users)
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao listar usuários: ${err.message || 'Falha de comunicação com o servidor.'}`,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [roleFilter, orgFilter, statusFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers()
  }

  const handleOpenCreateModal = () => {
    setCreateForm({
      name: '',
      email: '',
      password: `Cardio@${Math.floor(100000 + Math.random() * 900000)}`,
      phone: '',
      organization_id: organizations[0]?.id || '',
      role: 'clinic_operator',
      title_position: '',
      crm: '',
      crm_state: 'SP',
      rqe: '',
      specialty: 'Cardiologia Clínica e Eletrocardiografia',
    })
    setIsCreateModalOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setFeedbackMessage(null)
    try {
      await adminUserService.createUser(createForm)
      setFeedbackMessage({
        type: 'success',
        text: `Usuário ${createForm.name} cadastrado com sucesso e auditado no sistema.`,
      })
      setIsCreateModalOpen(false)
      fetchUsers()
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao cadastrar usuário: ${err.message || 'Dados inválidos ou e-mail já existente.'}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenEditModal = (user: AdminManagedUserItem) => {
    setSelectedUser(user)
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      password: '',
      crm: user.doctor?.crm || '',
      crm_state: user.doctor?.crm_state || 'SP',
      rqe: user.doctor?.rqe || '',
      specialty: user.doctor?.specialty || '',
    })
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    if (!selectedUser) return
    e.preventDefault()
    setActionLoading(true)
    setFeedbackMessage(null)
    try {
      await adminUserService.updateUser(selectedUser.id, editForm)
      setFeedbackMessage({
        type: 'success',
        text: `Cadastro de ${selectedUser.email} atualizado com sucesso.`,
      })
      setIsEditModalOpen(false)
      fetchUsers()
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao atualizar usuário: ${err.message}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenSuspendModal = (user: AdminManagedUserItem) => {
    setSelectedUser(user)
    setSuspendReason('Suspensão administrativa por deliberação da gestão central')
    setIsSuspendModalOpen(true)
  }

  const handleConfirmSuspend = async () => {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      await adminUserService.suspendUser(selectedUser.id, suspendReason)
      setFeedbackMessage({
        type: 'success',
        text: `Usuário ${selectedUser.email} suspenso e sessões ativas revogadas.`,
      })
      setIsSuspendModalOpen(false)
      fetchUsers()
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Não foi possível suspender o usuário: ${err.message}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async (user: AdminManagedUserItem) => {
    setActionLoading(true)
    try {
      await adminUserService.reactivateUser(user.id)
      setFeedbackMessage({
        type: 'success',
        text: `Usuário ${user.email} e seus vínculos organizacionais foram reativados.`,
      })
      fetchUsers()
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao reativar usuário: ${err.message}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenRoleModal = (user: AdminManagedUserItem) => {
    setSelectedUser(user)
    setRoleForm({
      action: 'assign',
      organization_id: organizations[0]?.id || '',
      role: 'clinic_operator',
      title_position: '',
    })
    setIsRoleModalOpen(true)
  }

  const handleRoleSubmit = async (e: React.FormEvent) => {
    if (!selectedUser) return
    e.preventDefault()
    setActionLoading(true)
    try {
      await adminUserService.manageRole(selectedUser.id, roleForm)
      setFeedbackMessage({
        type: 'success',
        text: `Vínculo organizacional atualizado para ${selectedUser.email}.`,
      })
      setIsRoleModalOpen(false)
      fetchUsers()
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao gerenciar papel: ${err.message}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenResetModal = (user: AdminManagedUserItem) => {
    setSelectedUser(user)
    setTemporaryPasswordResult(null)
    setIsResetModalOpen(true)
  }

  const handleGenerateTemporaryPassword = async () => {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      const tempPass = `Cardio@${Math.floor(100000 + Math.random() * 900000)}`
      const res = await adminUserService.sendInviteOrReset(selectedUser.id, {
        type: 'set_temporary_password',
        temporary_password: tempPass,
      })
      setTemporaryPasswordResult(res.temporaryPassword || tempPass)
      setFeedbackMessage({
        type: 'success',
        text: `Nova senha temporária atribuída e sessões anteriores invalidadas.`,
      })
      fetchUsers()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao gerar senha temporária: ${err.message}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenDeleteModal = (user: AdminManagedUserItem) => {
    setSelectedUser(user)
    setDeleteConfirmationText('')
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedUser) return
    if (deleteConfirmationText !== 'EXCLUIR') {
      alert("Digite a palavra 'EXCLUIR' para confirmar esta operação crítica.")
      return
    }
    setActionLoading(true)
    try {
      await adminUserService.deleteUserSafe(selectedUser.id)
      setFeedbackMessage({
        type: 'success',
        text: `Usuário ${selectedUser.email} excluído com sucesso após validação de integridade.`,
      })
      setIsDeleteModalOpen(false)
      fetchUsers()
      if (onRefreshData) onRefreshData()
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Exclusão bloqueada: ${err.message}`,
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Notificação / Feedback de Ação */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-900"
            onClick={() => setFeedbackMessage(null)}
          >
            ×
          </Button>
        </div>
      )}

      {/* Barra de Título & Ações Principais */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#4A90D9]" />
            <h2 className="text-base font-bold text-[#2F3942]">
              Administração Autônoma de Usuários & Vínculos
            </h2>
            <Badge className="bg-blue-50 text-[#4A90D9] border-blue-200 text-[10px]">
              {users.length} usuários
            </Badge>
          </div>
          <p className="text-xs text-[#6F7780] mt-0.5">
            Gestão com autonomia da conta principal: controle de cardiologistas, gestores, clínicas
            e proteção de registros clínicos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
            variant="outline"
            className="h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="h-9 text-xs bg-[#4A90D9] hover:bg-[#3b7ac0] text-white font-semibold gap-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="p-3 bg-white border-slate-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pl-8 text-xs h-9 bg-slate-50/50"
            />
          </div>

          <div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="text-xs h-9 bg-slate-50/50">
                <SelectValue placeholder="Filtrar por Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Papéis</SelectItem>
                <SelectItem value="admin">Administrador Geral</SelectItem>
                <SelectItem value="cardiologist">Médico Cardiologista</SelectItem>
                <SelectItem value="clinic_manager">Gestor de Clínica</SelectItem>
                <SelectItem value="clinic_operator">Operador de Clínica</SelectItem>
                <SelectItem value="financial">Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="text-xs h-9 bg-slate-50/50">
                <SelectValue placeholder="Filtrar por Organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Clínicas / Orgs</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org.type === 'provider' ? 'Central' : 'Cliente'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs h-9 bg-slate-50/50 flex-1">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Situações</SelectItem>
                <SelectItem value="active">Apenas Ativos</SelectItem>
                <SelectItem value="inactive">Apenas Suspensos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="submit"
              size="sm"
              className="h-9 px-3 text-xs bg-slate-800 hover:bg-slate-900 text-white"
            >
              <Filter className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabela de Usuários */}
      <Card className="border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F6F4] border-b border-slate-200 text-[#2F3942] font-semibold">
              <tr>
                <th className="p-3">Usuário / Identificação</th>
                <th className="p-3">Vínculo Organizacional</th>
                <th className="p-3">Papéis Atribuídos</th>
                <th className="p-3">Dados Médicos (CRM/RQE)</th>
                <th className="p-3">Segurança & MFA</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#6F7780]">
                    {loading
                      ? 'Carregando lista de usuários...'
                      : 'Nenhum usuário encontrado para os critérios de busca.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isPrimary = u.is_primary_admin || u.email === 'marcio.eliziario@hotmail.com'
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Usuário */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isPrimary
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : u.doctor
                                  ? 'bg-blue-100 text-[#4A90D9] border border-blue-200'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.name
                              ? u.name.charAt(0).toUpperCase()
                              : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{u.name || 'Sem nome cadastrado'}</span>
                              {isPrimary && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] px-1 py-0">
                                  Admin Principal
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                            {u.phone && <div className="text-[10px] text-slate-400">{u.phone}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Vínculo Organizacional */}
                      <td className="p-3">
                        {u.organizations.length === 0 ? (
                          <span className="text-slate-400 italic">Sem vínculos</span>
                        ) : (
                          <div className="space-y-1">
                            {u.organizations.map((org) => (
                              <div key={org.id} className="flex items-center gap-1.5 text-[11px]">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span className="font-medium text-slate-800">
                                  {org.organization_name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ({org.organization_type === 'provider' ? 'Central' : 'Clínica'})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Papéis */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.organizations.map((org) => {
                            let badgeStyle = 'bg-slate-100 text-slate-700'
                            let labelText: string = org.role
                            if (org.role === 'admin') {
                              badgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              labelText = 'Admin Geral'
                            } else if (org.role === 'cardiologist') {
                              badgeStyle = 'bg-blue-50 text-[#4A90D9] border-blue-200'
                              labelText = 'Cardiologista'
                            } else if (org.role === 'clinic_manager') {
                              badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              labelText = 'Gestor Clínica'
                            } else if (org.role === 'clinic_operator') {
                              badgeStyle = 'bg-slate-100 text-slate-800'
                              labelText = 'Operador'
                            }

                            return (
                              <Badge
                                key={org.id}
                                variant="outline"
                                className={`text-[10px] ${badgeStyle}`}
                              >
                                {labelText}
                              </Badge>
                            )
                          })}
                        </div>
                      </td>

                      {/* Dados Médicos */}
                      <td className="p-3">
                        {u.doctor ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-mono font-bold text-slate-900 text-[11px]">
                              <Stethoscope className="w-3 h-3 text-[#4A90D9]" />
                              <span>
                                CRM {u.doctor.crm}-{u.doctor.crm_state}
                              </span>
                            </div>
                            {u.doctor.rqe && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                RQE: {u.doctor.rqe}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-600 truncate max-w-[150px]">
                              {u.doctor.specialty || 'Cardiologia'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Segurança & MFA */}
                      <td className="p-3">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1">
                            {u.mfa_enabled ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] gap-1 px-1.5 py-0">
                                <ShieldCheck className="w-2.5 h-2.5" />
                                <span>MFA Ativo</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-slate-500 text-[9px] px-1.5 py-0"
                              >
                                MFA Opcional
                              </Badge>
                            )}
                          </div>
                          {u.last_revoked_at && (
                            <div className="text-[9px] text-slate-400 font-mono">
                              Revogado: {new Date(u.last_revoked_at).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Situação */}
                      <td className="p-3">
                        {u.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Ativo</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] gap-1 font-semibold">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Suspenso</span>
                          </Badge>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            <DropdownMenuLabel className="text-[11px] text-slate-500">
                              Gerenciar Usuário
                            </DropdownMenuLabel>

                            <DropdownMenuItem
                              onClick={() => handleOpenEditModal(u)}
                              className="cursor-pointer gap-2"
                            >
                              <span>Editar Cadastro</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleOpenRoleModal(u)}
                              className="cursor-pointer gap-2"
                            >
                              <span>Atribuir / Revogar Papéis</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleOpenResetModal(u)}
                              className="cursor-pointer gap-2"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Redefinir Acesso / Senha</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {u.is_active ? (
                              <DropdownMenuItem
                                onClick={() => handleOpenSuspendModal(u)}
                                disabled={isPrimary}
                                className={`cursor-pointer gap-2 ${isPrimary ? 'opacity-40 cursor-not-allowed' : 'text-amber-700'}`}
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Suspender Usuário</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleReactivate(u)}
                                className="cursor-pointer gap-2 text-emerald-700"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Reativar Usuário</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleOpenDeleteModal(u)}
                              disabled={isPrimary}
                              className={`cursor-pointer gap-2 text-rose-600 font-semibold ${
                                isPrimary ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Exclusão Segura</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL 1: CADASTRAR NOVO USUÁRIO */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#4A90D9]" />
              <span>Cadastrar Novo Usuário na Central</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Cadastre operadores, gestores de clínica, médicos cardiologistas ou administradores
              com registro em trilha de auditoria.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Nome Completo *</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Ex: Dra. Mariana Costa"
                  required
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">E-mail Institucional *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="usuario@clinica.com.br"
                  required
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                <Input
                  value={createForm.phone || ''}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Senha Inicial Temporária *</Label>
                <Input
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs font-semibold">Organização Vinculada *</Label>
                <Select
                  value={createForm.organization_id}
                  onValueChange={(val) => setCreateForm({ ...createForm, organization_id: val })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue placeholder="Selecione a Organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.type === 'provider' ? 'Central Prestadora' : 'Clínica'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Papel Inicial (Role) *</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(val: UserRole) => setCreateForm({ ...createForm, role: val })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue placeholder="Selecione o Papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinic_operator">Operador da Clínica</SelectItem>
                    <SelectItem value="clinic_manager">Gestor da Clínica</SelectItem>
                    <SelectItem value="cardiologist">Médico Cardiologista Laudador</SelectItem>
                    {isCurrentPrimaryAdmin && (
                      <SelectItem value="admin">Administrador Geral</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos Específicos para Cardiologista */}
            {createForm.role === 'cardiologist' && (
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-3 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E4C92]">
                  <Stethoscope className="w-4 h-4 text-[#4A90D9]" />
                  <span>Dados Profissionais do Cardiologista</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] font-semibold">CRM *</Label>
                    <Input
                      value={createForm.crm || ''}
                      onChange={(e) => setCreateForm({ ...createForm, crm: e.target.value })}
                      placeholder="Ex: 123456"
                      required={createForm.role === 'cardiologist'}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold">UF do CRM *</Label>
                    <Input
                      value={createForm.crm_state || 'SP'}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, crm_state: e.target.value.toUpperCase() })
                      }
                      maxLength={2}
                      required={createForm.role === 'cardiologist'}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold">RQE (Opcional)</Label>
                    <Input
                      value={createForm.rqe || ''}
                      onChange={(e) => setCreateForm({ ...createForm, rqe: e.target.value })}
                      placeholder="Ex: 98765"
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">Especialidade / Título</Label>
                  <Input
                    value={createForm.specialty || ''}
                    onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })}
                    placeholder="Cardiologia Clínica e Eletrocardiografia"
                    className="text-xs mt-1"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={actionLoading}
                className="text-xs bg-[#4A90D9] hover:bg-[#3b7ac0] text-white"
              >
                {actionLoading ? 'Gravando no Servidor...' : 'Confirmar e Salvar Cadastro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDITAR CADASTRO */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Editar Dados de Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Atualize as informações cadastrais de {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-semibold">Nome Completo</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Telefone</Label>
              <Input
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Nova Senha (deixe em branco para não alterar)
              </Label>
              <Input
                value={editForm.password || ''}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
                className="text-xs mt-1 font-mono"
              />
            </div>

            {selectedUser?.doctor && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 mt-2">
                <span className="text-xs font-bold text-slate-800">Dados do Médico</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">CRM</Label>
                    <Input
                      value={editForm.crm || ''}
                      onChange={(e) => setEditForm({ ...editForm, crm: e.target.value })}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">UF CRM</Label>
                    <Input
                      value={editForm.crm_state || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, crm_state: e.target.value.toUpperCase() })
                      }
                      maxLength={2}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">RQE</Label>
                  <Input
                    value={editForm.rqe || ''}
                    onChange={(e) => setEditForm({ ...editForm, rqe: e.target.value })}
                    className="text-xs mt-1 font-mono"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={actionLoading}
                className="text-xs bg-[#4A90D9] hover:bg-[#3b7ac0] text-white"
              >
                {actionLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: GERENCIAR PAPÉIS E VÍNCULOS ORGANIZACIONAIS */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Vínculos Organizacionais & Papéis
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Atribuir ou revogar papéis de {selectedUser?.name || selectedUser?.email} em clínicas
              e na central.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Vínculos Atuais:
              </span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedUser?.organizations.map((org) => (
                  <div
                    key={org.id}
                    className="p-2 rounded bg-slate-50 border border-slate-200 text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{org.organization_name}</div>
                      <div className="text-[10px] text-slate-500">Papel: {org.role}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRoleForm({
                          action: 'revoke',
                          organization_id: org.organization_id,
                          role: org.role,
                          title_position: '',
                        })
                      }}
                      className="h-6 text-[11px] text-rose-600 hover:bg-rose-50"
                    >
                      Revogar
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleRoleSubmit} className="pt-2 border-t border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Atribuir Novo Vínculo:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Organização</Label>
                  <Select
                    value={roleForm.organization_id}
                    onValueChange={(val) => setRoleForm({ ...roleForm, organization_id: val })}
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Papel</Label>
                  <Select
                    value={roleForm.role}
                    onValueChange={(val: UserRole) => setRoleForm({ ...roleForm, role: val })}
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic_operator">Operador</SelectItem>
                      <SelectItem value="clinic_manager">Gestor Clínica</SelectItem>
                      <SelectItem value="cardiologist">Cardiologista</SelectItem>
                      {isCurrentPrimaryAdmin && <SelectItem value="admin">Admin Geral</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs bg-[#4A90D9] hover:bg-[#3b7ac0] text-white"
                >
                  {actionLoading ? 'Processando...' : 'Aplicar Alteração'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: REDEFINIÇÃO DE ACESSO / SENHA TEMPORÁRIA */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              <span>Redefinir Acesso do Usuário</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Gera uma nova senha temporária imediata ou envia e-mail de redefinição para{' '}
              {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                A geração de nova senha rotaciona as chaves de sessão e desconecta imediatamente
                qualquer sessão ativa do usuário.
              </span>
            </div>

            {temporaryPasswordResult ? (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-300 space-y-2">
                <span className="text-xs font-bold text-emerald-900 block">
                  Senha Provisória Configurada:
                </span>
                <div className="p-2 bg-white rounded border border-emerald-200 font-mono text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>{temporaryPasswordResult}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(temporaryPasswordResult)
                      alert('Senha copiada para a área de transferência!')
                    }}
                    className="h-6 text-xs text-emerald-700"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                  </Button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Transmita esta senha ao usuário por canal oficial e seguro. No primeiro acesso,
                  solicite a troca obrigatória.
                </p>
              </div>
            ) : (
              <Button
                onClick={handleGenerateTemporaryPassword}
                disabled={actionLoading}
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9"
              >
                {actionLoading ? 'Gerando Senha...' : 'Gerar Senha Temporária & Revogar Sessões'}
              </Button>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetModalOpen(false)}
                className="text-xs"
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: SUSPENDER USUÁRIO (AÇÃO CRÍTICA) */}
      <Dialog open={isSuspendModalOpen} onOpenChange={setIsSuspendModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Confirmar Suspensão de Usuário</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              A suspensão inativa o acesso do usuário e encerra instantaneamente todas as suas
              sessões logadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-semibold">Usuário Alvo:</div>
              <div className="font-mono">
                {selectedUser?.name} ({selectedUser?.email})
              </div>
              <div className="text-[11px] text-amber-800 pt-1">
                • Registros clínicos, laudos já assinados e documentos permanecem íntegros para
                auditoria legal.
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Justificativa da Suspensão *</Label>
              <Input
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Ex: Desligamento institucional ou ordem administrativa"
                className="text-xs mt-1"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSuspendModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmSuspend}
                disabled={actionLoading || !suspendReason.trim()}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {actionLoading ? 'Suspendendo...' : 'Confirmar Suspensão & Revogar Sessões'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: EXCLUSÃO SEGURA COM VALIDAÇÃO DE DEPENDÊNCIAS CLÍNICAS */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Exclusão Segura de Cadastro</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Operação estritamente bloqueada se houver qualquer laudo, exame ou fechamento
              vinculado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Proteção Médica e Jurídica:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                A plataforma impede a exclusão física de usuários que possuam exames solicitados,
                laudos emitidos ou assinados, ou fechamentos financeiros vinculados, assegurando a
                conformidade com as resoluções do CFM e obrigações de guarda pericial.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Para confirmar a exclusão segura, digite{' '}
                <span className="font-mono text-rose-600 font-bold">EXCLUIR</span> abaixo:
              </Label>
              <Input
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="EXCLUIR"
                className="text-xs mt-1 font-mono uppercase"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={actionLoading || deleteConfirmationText !== 'EXCLUIR'}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {actionLoading ? 'Validando e Excluindo...' : 'Executar Exclusão Segura'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
