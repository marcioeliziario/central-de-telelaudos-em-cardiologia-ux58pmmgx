import React, { useState, useEffect } from 'react'
import {
  organizationService,
  unitService,
  commercialContractService,
  adminUserService,
} from '@/services/telelaudosService'
import { Organization, Unit } from '@/types/telelaudos'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Building2,
  Plus,
  MapPin,
  Search,
  Power,
  PowerOff,
  Edit,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react'

interface AdminClinicsSectionProps {
  organizations: Organization[]
  units: Unit[]
  onRefreshData: () => Promise<void> | void
}

export const AdminClinicsSection: React.FC<AdminClinicsSectionProps> = ({
  organizations,
  units,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'clinics' | 'units' | 'contracts'>('clinics')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [contracts, setContracts] = useState<any[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)

  // Dialogs
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false)
  const [isEditOrgDialogOpen, setIsEditOrgDialogOpen] = useState(false)
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Form states: Nova Organização
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgTradeName, setNewOrgTradeName] = useState('')
  const [newOrgCnpj, setNewOrgCnpj] = useState('')
  const [newOrgEmail, setNewOrgEmail] = useState('')
  const [newOrgPhone, setNewOrgPhone] = useState('')
  const [newOrgCity, setNewOrgCity] = useState('')
  const [newOrgState, setNewOrgState] = useState('SP')

  // Form states: Edição de Organização
  const [editOrgName, setEditOrgName] = useState('')
  const [editOrgTradeName, setEditOrgTradeName] = useState('')
  const [editOrgCnpj, setEditOrgCnpj] = useState('')
  const [editOrgEmail, setEditOrgEmail] = useState('')
  const [editOrgPhone, setEditOrgPhone] = useState('')
  const [editOrgCity, setEditOrgCity] = useState('')
  const [editOrgState, setEditOrgState] = useState('')

  // Form states: Nova Unidade
  const [unitOrgId, setUnitOrgId] = useState('')
  const [unitName, setUnitName] = useState('')
  const [unitCode, setUnitCode] = useState('')
  const [unitCnes, setUnitCnes] = useState('')
  const [unitAddress, setUnitAddress] = useState('')
  const [unitCity, setUnitCity] = useState('')
  const [unitState, setUnitState] = useState('SP')

  // Carregar contratos comerciais vinculados
  const loadContracts = async () => {
    setContractsLoading(true)
    try {
      const list = await commercialContractService.getAll()
      setContracts(list)
    } catch {
      setContracts([])
    } finally {
      setContractsLoading(false)
    }
  }

  useEffect(() => {
    loadContracts()
  }, [])

  // Filtragem
  const filteredOrgs = organizations.filter((org) => {
    if (statusFilter === 'active' && !org.is_active) return false
    if (statusFilter === 'inactive' && org.is_active) return false
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      org.name?.toLowerCase().includes(term) ||
      org.trade_name?.toLowerCase().includes(term) ||
      org.cnpj?.toLowerCase().includes(term) ||
      org.city?.toLowerCase().includes(term)
    )
  })

  // Ações de Organização
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName || !newOrgCnpj) return
    setIsSubmitting(true)
    setActionFeedback(null)
    try {
      await organizationService.create({
        name: newOrgName.trim(),
        trade_name: newOrgTradeName.trim() || undefined,
        cnpj: newOrgCnpj.trim(),
        email: newOrgEmail.trim() || undefined,
        phone: newOrgPhone.trim() || undefined,
        city: newOrgCity.trim() || undefined,
        state: newOrgState.trim().toUpperCase() || 'SP',
        type: 'client',
        is_active: true,
      })
      setIsOrgDialogOpen(false)
      setNewOrgName('')
      setNewOrgTradeName('')
      setNewOrgCnpj('')
      setNewOrgEmail('')
      setNewOrgPhone('')
      setNewOrgCity('')
      setActionFeedback({ type: 'success', text: `Clínica ${newOrgName} cadastrada com sucesso.` })
      await onRefreshData()
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: `Erro ao cadastrar organização: ${err.message}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEditOrg = (org: Organization) => {
    setSelectedOrg(org)
    setEditOrgName(org.name || '')
    setEditOrgTradeName(org.trade_name || '')
    setEditOrgCnpj(org.cnpj || '')
    setEditOrgEmail(org.email || '')
    setEditOrgPhone(org.phone || '')
    setEditOrgCity(org.city || '')
    setEditOrgState(org.state || 'SP')
    setIsEditOrgDialogOpen(true)
  }

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg) return
    setIsSubmitting(true)
    setActionFeedback(null)
    try {
      await adminUserService.updateOrganization(selectedOrg.id, {
        name: editOrgName.trim(),
        trade_name: editOrgTradeName.trim() || undefined,
        cnpj: editOrgCnpj.trim() || undefined,
        email: editOrgEmail.trim() || undefined,
        phone: editOrgPhone.trim() || undefined,
        city: editOrgCity.trim() || undefined,
        state: editOrgState.trim().toUpperCase() || undefined,
      })
      setIsEditOrgDialogOpen(false)
      setActionFeedback({
        type: 'success',
        text: `Dados de ${editOrgName} atualizados com sucesso.`,
      })
      await onRefreshData()
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: `Erro ao atualizar organização: ${err.message}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleOrgStatus = async (org: Organization) => {
    const nextStatus = !org.is_active
    const actionLabel = nextStatus ? 'reativar' : 'desativar'
    if (!confirm(`Deseja realmente ${actionLabel} a organização "${org.name}"?`)) return
    try {
      await adminUserService.updateOrganization(org.id, { is_active: nextStatus })
      setActionFeedback({
        type: 'success',
        text: `Organização ${org.name} ${nextStatus ? 'reativada' : 'desativada'} com sucesso.`,
      })
      await onRefreshData()
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: `Erro ao alterar status da organização: ${err.message}`,
      })
    }
  }

  // Ações de Unidade
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitName || !unitOrgId) return
    setIsSubmitting(true)
    setActionFeedback(null)
    try {
      await unitService.create({
        organization_id: unitOrgId,
        name: unitName.trim(),
        code: unitCode.trim() || undefined,
        cnes: unitCnes.trim() || undefined,
        address: unitAddress.trim() || undefined,
        city: unitCity.trim() || undefined,
        state: unitState.trim().toUpperCase() || 'SP',
        is_active: true,
      })
      setIsUnitDialogOpen(false)
      setUnitName('')
      setUnitCode('')
      setUnitCnes('')
      setUnitAddress('')
      setUnitCity('')
      setActionFeedback({ type: 'success', text: `Unidade física ${unitName} cadastrada.` })
      await onRefreshData()
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: `Erro ao cadastrar unidade: ${err.message}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {actionFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold underline ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Sub-navegação interna limpa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E3E6E8]">
        <div className="flex items-center gap-1.5 bg-[#F7F6F4] p-1 rounded-lg border border-[#E3E6E8] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('clinics')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'clinics'
                ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
                : 'text-[#6F7780] hover:text-[#2F3942]'
            }`}
          >
            Clínicas Cadastradas ({organizations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'units'
                ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
                : 'text-[#6F7780] hover:text-[#2F3942]'
            }`}
          >
            Unidades de Coleta ({units.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'contracts'
                ? 'bg-white text-[#2F3942] font-semibold shadow-2xs border border-[#E3E6E8]'
                : 'text-[#6F7780] hover:text-[#2F3942]'
            }`}
          >
            Contratos Vinculados ({contracts.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'clinics' && (
            <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs h-8 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Clínica</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold text-[#2F3942]">
                    Cadastrar Nova Clínica Contratante
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateOrg} className="space-y-3 pt-2 text-xs">
                  <div>
                    <Label className="text-xs font-semibold text-[#2F3942]">Razão Social *</Label>
                    <Input
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Ex: Policlínica Cardiocenter Ltda"
                      required
                      className="text-xs h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#2F3942]">Nome Fantasia</Label>
                    <Input
                      value={newOrgTradeName}
                      onChange={(e) => setNewOrgTradeName(e.target.value)}
                      placeholder="Ex: Cardiocenter"
                      className="text-xs h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#2F3942]">CNPJ *</Label>
                    <Input
                      value={newOrgCnpj}
                      onChange={(e) => setNewOrgCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      required
                      className="text-xs h-9 mt-1 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold text-[#2F3942]">
                        E-mail de Contato
                      </Label>
                      <Input
                        type="email"
                        value={newOrgEmail}
                        onChange={(e) => setNewOrgEmail(e.target.value)}
                        placeholder="contato@clinica.com"
                        className="text-xs h-9 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-[#2F3942]">Telefone</Label>
                      <Input
                        value={newOrgPhone}
                        onChange={(e) => setNewOrgPhone(e.target.value)}
                        placeholder="(11) 9999-9999"
                        className="text-xs h-9 mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold text-[#2F3942]">Cidade</Label>
                      <Input
                        value={newOrgCity}
                        onChange={(e) => setNewOrgCity(e.target.value)}
                        placeholder="Ex: Campinas"
                        className="text-xs h-9 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-[#2F3942]">UF</Label>
                      <Input
                        value={newOrgState}
                        onChange={(e) => setNewOrgState(e.target.value)}
                        maxLength={2}
                        className="text-xs h-9 mt-1 uppercase"
                      />
                    </div>
                  </div>
                  <DialogFooter className="pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOrgDialogOpen(false)}
                      className="text-xs h-8"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || !newOrgName || !newOrgCnpj}
                      className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs h-8"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Cadastrar Clínica</span>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {activeTab === 'units' && (
            <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs h-8 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Unidade</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold text-[#2F3942]">
                    Cadastrar Unidade de Coleta
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUnit} className="space-y-3 pt-2 text-xs">
                  <div>
                    <Label className="text-xs font-semibold text-[#2F3942]">
                      Clínica Pertencente *
                    </Label>
                    <select
                      value={unitOrgId}
                      onChange={(e) => setUnitOrgId(e.target.value)}
                      required
                      className="w-full mt-1 h-9 px-3 border border-[#E3E6E8] rounded-md text-xs bg-white text-[#2F3942]"
                    >
                      <option value="">Selecione a clínica...</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.type === 'provider' ? 'Prestadora' : 'Contratante'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#2F3942]">
                      Nome da Unidade / Posto *
                    </Label>
                    <Input
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder="Ex: Unidade Centro / Posto de Coleta 01"
                      required
                      className="text-xs h-9 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold text-[#2F3942]">Código Interno</Label>
                      <Input
                        value={unitCode}
                        onChange={(e) => setUnitCode(e.target.value)}
                        placeholder="Ex: UNI-01"
                        className="text-xs h-9 mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-[#2F3942]">CNES</Label>
                      <Input
                        value={unitCnes}
                        onChange={(e) => setUnitCnes(e.target.value)}
                        placeholder="Número CNES"
                        className="text-xs h-9 mt-1 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-[#2F3942]">Endereço</Label>
                    <Input
                      value={unitAddress}
                      onChange={(e) => setUnitAddress(e.target.value)}
                      placeholder="Rua, número, bairro"
                      className="text-xs h-9 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs font-semibold text-[#2F3942]">Cidade</Label>
                      <Input
                        value={unitCity}
                        onChange={(e) => setUnitCity(e.target.value)}
                        placeholder="Cidade"
                        className="text-xs h-9 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-[#2F3942]">UF</Label>
                      <Input
                        value={unitState}
                        onChange={(e) => setUnitState(e.target.value)}
                        maxLength={2}
                        className="text-xs h-9 mt-1 uppercase"
                      />
                    </div>
                  </div>
                  <DialogFooter className="pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsUnitDialogOpen(false)}
                      className="text-xs h-8"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || !unitName || !unitOrgId}
                      className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs h-8"
                    >
                      {isSubmitting ? 'Salvando...' : 'Cadastrar Unidade'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ABA 1: CLÍNICAS */}
      {activeTab === 'clinics' && (
        <div className="space-y-3">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6F7780]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, fantasia, CNPJ ou cidade..."
                className="pl-8 text-xs h-8 bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#6F7780]">
              <span className="text-[11px]">Situação:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-[#2F3942] text-white font-semibold'
                    : 'bg-white text-[#6F7780] border border-[#E3E6E8]'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-emerald-700 text-white font-semibold'
                    : 'bg-white text-[#6F7780] border border-[#E3E6E8]'
                }`}
              >
                Ativas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === 'inactive'
                    ? 'bg-rose-700 text-white font-semibold'
                    : 'bg-white text-[#6F7780] border border-[#E3E6E8]'
                }`}
              >
                Inativas
              </button>
            </div>
          </div>

          <Card className="border-[#E3E6E8] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F4] border-b border-[#E3E6E8] text-[#2F3942] font-semibold">
                  <tr>
                    <th className="p-3">Clínica / Razão Social</th>
                    <th className="p-3">CNPJ</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Localização</th>
                    <th className="p-3">Unidades</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6E8]/60">
                  {filteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#6F7780]">
                        Nenhuma organização encontrada com os critérios informados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org) => {
                      const orgUnitsCount = units.filter((u) => u.organization_id === org.id).length
                      return (
                        <tr key={org.id} className="hover:bg-[#F7F6F4]/50 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-[#2F3942]">{org.name}</div>
                            {org.trade_name && (
                              <div className="text-[11px] text-[#6F7780] font-normal">
                                {org.trade_name}
                              </div>
                            )}
                            {(org.email || org.phone) && (
                              <div className="text-[10px] text-[#8C959E] flex items-center gap-2 mt-0.5">
                                {org.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-2.5 h-2.5" />
                                    {org.email}
                                  </span>
                                )}
                                {org.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" />
                                    {org.phone}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[#6F7780]">{org.cnpj}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                org.type === 'provider'
                                  ? 'bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/30 text-[10px]'
                                  : 'bg-slate-100 text-[#2F3942] border-slate-200 text-[10px]'
                              }
                            >
                              {org.type === 'provider'
                                ? 'Prestadora Central'
                                : 'Clínica Contratante'}
                            </Badge>
                          </td>
                          <td className="p-3 text-[#6F7780]">
                            {org.city ? `${org.city}/${org.state}` : '—'}
                          </td>
                          <td className="p-3 text-[#2F3942] font-semibold">
                            {orgUnitsCount} {orgUnitsCount === 1 ? 'unidade' : 'unidades'}
                          </td>
                          <td className="p-3">
                            {org.is_active ? (
                              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-medium">
                                Ativa
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] font-medium">
                                Inativa
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditOrg(org)}
                                className="h-7 px-2 text-[11px] text-[#2F3942] border-[#E3E6E8] hover:bg-[#F7F6F4]"
                                title="Editar informações cadastrais"
                              >
                                <Edit className="w-3 h-3 mr-1 text-[#6F7780]" />
                                <span>Editar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleOrgStatus(org)}
                                className={`h-7 px-2 text-[11px] border-[#E3E6E8] ${
                                  org.is_active
                                    ? 'text-rose-700 hover:bg-rose-50 hover:border-rose-200'
                                    : 'text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200'
                                }`}
                                title={org.is_active ? 'Desativar cadastro' : 'Reativar cadastro'}
                              >
                                {org.is_active ? (
                                  <>
                                    <PowerOff className="w-3 h-3 mr-1" />
                                    <span>Desativar</span>
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-3 h-3 mr-1" />
                                    <span>Reativar</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ABA 2: UNIDADES */}
      {activeTab === 'units' && (
        <Card className="border-[#E3E6E8] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F4] border-b border-[#E3E6E8] text-[#2F3942] font-semibold">
                <tr>
                  <th className="p-3">Unidade de Coleta</th>
                  <th className="p-3">Código / CNES</th>
                  <th className="p-3">Clínica Pertencente</th>
                  <th className="p-3">Endereço / Cidade</th>
                  <th className="p-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E6E8]/60">
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#6F7780]">
                      Nenhuma unidade física cadastrada.
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-[#F7F6F4]/50 transition-colors">
                      <td className="p-3 font-semibold text-[#2F3942]">{unit.name}</td>
                      <td className="p-3 font-mono text-[#6F7780]">
                        {unit.code || '—'} {unit.cnes ? `(CNES: ${unit.cnes})` : ''}
                      </td>
                      <td className="p-3 text-[#2F3942]">
                        {unit.expand?.organization_id?.trade_name ||
                          unit.expand?.organization_id?.name ||
                          organizations.find((o) => o.id === unit.organization_id)?.name ||
                          '—'}
                      </td>
                      <td className="p-3 text-[#6F7780]">
                        {unit.address
                          ? `${unit.address}, ${unit.city || ''}/${unit.state || ''}`
                          : `${unit.city || '—'}/${unit.state || ''}`}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            unit.is_active !== false
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                              : 'bg-rose-50 text-rose-800 border-rose-300 text-[10px]'
                          }
                        >
                          {unit.is_active !== false ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA 3: CONTRATOS */}
      {activeTab === 'contracts' && (
        <Card className="border-[#E3E6E8] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F4] border-b border-[#E3E6E8] text-[#2F3942] font-semibold">
                <tr>
                  <th className="p-3">Contrato / Número</th>
                  <th className="p-3">Clínica Contratante</th>
                  <th className="p-3">Início de Vigência</th>
                  <th className="p-3">Dia Fechamento</th>
                  <th className="p-3">Prazo Pagamento</th>
                  <th className="p-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E6E8]/60">
                {contractsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6F7780]">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-[#4A90D9]" />
                      Carregando contratos comerciais...
                    </td>
                  </tr>
                ) : contracts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6F7780]">
                      Nenhum contrato comercial cadastrado no módulo financeiro.
                    </td>
                  </tr>
                ) : (
                  contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F7F6F4]/50 transition-colors">
                      <td className="p-3 font-semibold text-[#2F3942] font-mono">
                        {c.contract_number}
                      </td>
                      <td className="p-3 text-[#2F3942]">
                        {c.expand?.client_org_id?.name ||
                          organizations.find((o) => o.id === c.client_org_id)?.name ||
                          '—'}
                      </td>
                      <td className="p-3 text-[#6F7780]">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="p-3 text-[#6F7780]">Dia {c.closing_day} do mês</td>
                      <td className="p-3 text-[#6F7780]">{c.payment_terms_days} dias</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                              : 'bg-slate-100 text-slate-700 text-[10px]'
                          }
                        >
                          {c.status === 'active' ? 'Ativo' : c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DIALOG DE EDIÇÃO DE ORGANIZAÇÃO */}
      <Dialog open={isEditOrgDialogOpen} onOpenChange={setIsEditOrgDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#2F3942]">
              Editar Informações da Clínica
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateOrg} className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-[#2F3942]">Razão Social *</Label>
              <Input
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                required
                className="text-xs h-9 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#2F3942]">Nome Fantasia</Label>
              <Input
                value={editOrgTradeName}
                onChange={(e) => setEditOrgTradeName(e.target.value)}
                className="text-xs h-9 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#2F3942]">CNPJ *</Label>
              <Input
                value={editOrgCnpj}
                onChange={(e) => setEditOrgCnpj(e.target.value)}
                required
                className="text-xs h-9 mt-1 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-[#2F3942]">E-mail</Label>
                <Input
                  type="email"
                  value={editOrgEmail}
                  onChange={(e) => setEditOrgEmail(e.target.value)}
                  className="text-xs h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#2F3942]">Telefone</Label>
                <Input
                  value={editOrgPhone}
                  onChange={(e) => setEditOrgPhone(e.target.value)}
                  className="text-xs h-9 mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-[#2F3942]">Cidade</Label>
                <Input
                  value={editOrgCity}
                  onChange={(e) => setEditOrgCity(e.target.value)}
                  className="text-xs h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#2F3942]">UF</Label>
                <Input
                  value={editOrgState}
                  onChange={(e) => setEditOrgState(e.target.value)}
                  maxLength={2}
                  className="text-xs h-9 mt-1 uppercase"
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOrgDialogOpen(false)}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !editOrgName}
                className="bg-[#4A90D9] hover:bg-[#3b7dc2] text-white text-xs h-8"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
