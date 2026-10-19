import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  organizationService,
  unitService,
  doctorService,
  examService,
  patientService,
  auditService,
  slaService,
} from '@/services/telelaudosService'
import { Organization, Unit, Doctor, ExamRequest, Patient, AuditLog } from '@/types/telelaudos'
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  Settings,
  Activity,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminOverviewSection } from '@/components/AdminOverviewSection'
import { AdminClinicsSection } from '@/components/AdminClinicsSection'
import { AdminExamsSection } from '@/components/AdminExamsSection'
import { AdminSettingsSection } from '@/components/AdminSettingsSection'
import { UserManagementModule } from '@/components/UserManagementModule'
import FinancialManagementModule from '@/components/FinancialManagementModule'

export type AdminSectionKey = 'overview' | 'clinics' | 'users' | 'exams' | 'finance' | 'settings'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Sincroniza a seção ativa com o searchParam "section"
  const rawSection = searchParams.get('section') as AdminSectionKey | null
  const validSections: AdminSectionKey[] = [
    'overview',
    'clinics',
    'users',
    'exams',
    'finance',
    'settings',
  ]
  const initialSection = rawSection && validSections.includes(rawSection) ? rawSection : 'overview'

  const [activeSection, setActiveSection] = useState<AdminSectionKey>(initialSection)

  // Dados globais do backend
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [exams, setExams] = useState<ExamRequest[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [contractSlas, setContractSlas] = useState<any[]>([])
  const [slaJobTelemetry, setSlaJobTelemetry] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const handleSelectSection = (key: AdminSectionKey) => {
    setActiveSection(key)
    setSearchParams({ section: key }, { replace: true })
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [orgs, unts, docs, exms, pts, logs, slas, jobStatus] = await Promise.all([
        organizationService.getAll().catch(() => []),
        unitService.getAll().catch(() => []),
        doctorService.getAll().catch(() => []),
        examService.getAll().catch(() => []),
        patientService.getAll().catch(() => []),
        auditService.getRecent(40).catch(() => []),
        slaService.getAll().catch(() => []),
        slaService.getJobStatus().catch(() => null),
      ])
      setOrganizations(orgs)
      setUnits(unts)
      setDoctors(docs)
      setExams(exms)
      setPatients(pts)
      setAuditLogs(logs)
      setContractSlas(slas)
      setSlaJobTelemetry(jobStatus)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sincronização quando o searchParam mudar via URL ou navegação
  useEffect(() => {
    if (rawSection && validSections.includes(rawSection) && rawSection !== activeSection) {
      setActiveSection(rawSection)
    }
  }, [rawSection])

  return (
    <div className="space-y-5">
      {/* Barra de identificação da seção e ação rápida de recarregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E6E8]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#2F3942]">
            {activeSection === 'overview' && 'Visão Geral'}
            {activeSection === 'clinics' && 'Gestão de Clínicas'}
            {activeSection === 'users' && 'Usuários e Médicos'}
            {activeSection === 'exams' && 'Acompanhamento de Exames'}
            {activeSection === 'finance' && 'Financeiro & Contratos'}
            {activeSection === 'settings' && 'Configurações'}
          </h1>
          <p className="text-xs text-[#6F7780] mt-0.5">
            {activeSection === 'overview' &&
              'Indicadores operacionais essenciais e pendências que exigem atenção administrativa.'}
            {activeSection === 'clinics' &&
              'Cadastrar clínicas, gerenciar unidades, consultar contratos e gerenciar acessos.'}
            {activeSection === 'users' &&
              'Cadastrar usuários e cardiologistas, editar permissões, vincular e suspender contas.'}
            {activeSection === 'exams' &&
              'Consultar solicitações, acompanhar andamento e filtrar exames da plataforma.'}
            {activeSection === 'finance' &&
              'Exames faturáveis, valores por clínica, fechamentos de competência e demonstrativos.'}
            {activeSection === 'settings' &&
              'Segurança e MFA, trilha de auditoria, backup e informações técnicas do sistema.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="text-xs h-8 border-[#E3E6E8] text-[#2F3942] hover:bg-white gap-1.5"
            title="Atualizar dados do backend"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-[#6F7780] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Carregando...' : 'Atualizar'}</span>
          </Button>
        </div>
      </div>

      {/* Renderização da Seção Ativa */}
      {loading && organizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#4A90D9]" />
          <p className="text-xs text-[#6F7780]">Carregando dados da plataforma...</p>
        </div>
      ) : (
        <div>
          {/* 1. VISÃO GERAL */}
          {activeSection === 'overview' && (
            <AdminOverviewSection
              organizations={organizations}
              doctors={doctors}
              exams={exams}
              onNavigateSection={handleSelectSection}
            />
          )}

          {/* 2. CLÍNICAS */}
          {activeSection === 'clinics' && (
            <AdminClinicsSection
              organizations={organizations}
              units={units}
              onRefreshData={loadData}
            />
          )}

          {/* 3. USUÁRIOS E MÉDICOS */}
          {activeSection === 'users' && (
            <UserManagementModule organizations={organizations} onRefreshData={loadData} />
          )}

          {/* 4. EXAMES */}
          {activeSection === 'exams' && (
            <AdminExamsSection
              exams={exams}
              organizations={organizations}
              onRefreshData={loadData}
            />
          )}

          {/* 5. FINANCEIRO */}
          {activeSection === 'finance' && (
            <FinancialManagementModule organizations={organizations} onRefreshData={loadData} />
          )}

          {/* ACESSO SECUNDÁRIO: CONFIGURAÇÕES */}
          {activeSection === 'settings' && (
            <AdminSettingsSection
              auditLogs={auditLogs}
              contractSlas={contractSlas}
              slaJobTelemetry={slaJobTelemetry}
              onRefreshData={loadData}
            />
          )}
        </div>
      )}
    </div>
  )
}
