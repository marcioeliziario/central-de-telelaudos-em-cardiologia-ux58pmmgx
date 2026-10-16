import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  PenTool,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Upload,
  Lock,
  KeyRound,
  ShieldAlert,
  Loader2,
  FileCheck,
  Eye,
} from 'lucide-react'
import { doctorSignatureService, DoctorSignatureResponse } from '@/services/doctorSignatureService'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export function DoctorSignatureCard() {
  const { user } = useAuth()
  const [signatureData, setSignatureData] = useState<DoctorSignatureResponse['signature'] | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modais
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  // Campos do formulário de upload/substituição
  const [selectedImageDataUri, setSelectedImageDataUri] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthTotp, setReauthTotp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Carregar assinatura atual
  const fetchSignature = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const res = await doctorSignatureService.getCurrentSignature()
      if (res.success && res.hasSignature) {
        setSignatureData(res.signature)
      } else {
        setSignatureData(null)
      }
    } catch (err: any) {
      console.error('Erro ao buscar assinatura:', err)
      setErrorMsg('Não foi possível carregar o status da assinatura manuscrita.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSignature()
  }, [])

  // Manipular seleção do arquivo PNG/JPEG
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      alert('Formato inválido. Selecione uma imagem PNG ou JPEG.')
      return
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Tamanho excedido. A imagem deve ter no máximo 5MB.')
      return
    }

    setSelectedFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUri = event.target?.result as string
      setSelectedImageDataUri(dataUri)
    }
    reader.readAsDataURL(file)
  }

  // Confirmar Cadastro ou Substituição com Reautenticação
  const handleSaveSignature = async () => {
    if (!selectedImageDataUri) {
      alert('Selecione uma imagem de assinatura primeiro.')
      return
    }
    if (!reauthPassword) {
      alert('Informe sua senha atual para autorizar esta operação sensível.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await doctorSignatureService.saveSignature({
        password: reauthPassword,
        totp_code: reauthTotp.trim() || undefined,
        image_data_uri: selectedImageDataUri,
        file_name: selectedFileName || 'assinatura_manuscrita.png',
      })

      setSuccessMsg(res.message)
      setIsUploadModalOpen(false)
      setSelectedImageDataUri(null)
      setSelectedFileName('')
      setReauthPassword('')
      setReauthTotp('')
      await fetchSignature()
    } catch (err: any) {
      console.error('Erro ao salvar assinatura:', err)
      const message = getErrorMessage(err)
      setErrorMsg(message)
      alert(message || 'Falha ao salvar assinatura. Verifique sua senha e código TOTP.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirmar Remoção com Reautenticação
  const handleRemoveSignature = async () => {
    if (!reauthPassword) {
      alert('Informe sua senha atual para autorizar a remoção.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await doctorSignatureService.removeSignature({
        password: reauthPassword,
        totp_code: reauthTotp.trim() || undefined,
      })

      setSuccessMsg(res.message)
      setIsRemoveModalOpen(false)
      setReauthPassword('')
      setReauthTotp('')
      await fetchSignature()
    } catch (err: any) {
      console.error('Erro ao remover assinatura:', err)
      const message = getErrorMessage(err)
      setErrorMsg(message)
      alert(message || 'Falha ao remover assinatura. Verifique sua senha e código TOTP.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-[#E3E6E8] bg-white text-[#2F3942] shadow-[0_1px_3px_rgba(47,57,66,0.03)] rounded-xl overflow-hidden">
      <CardHeader className="bg-[#F7F6F4]/50 border-b border-[#E3E6E8] pb-3.5 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#4A90D9]/10 text-[#4A90D9]">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-[#2F3942] flex items-center gap-2">
                <span>Minha Assinatura Manuscrita</span>
                {signatureData?.isActive && (
                  <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 text-[10px] border-emerald-300 font-medium">
                    Ativa
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-[#6F7780] mt-0.5">
                Imagem escaneada incorporada na estampa médica da emissão de laudos (CFM nº
                2.314/2022)
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signatureData ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="h-8 text-xs gap-1.5 border-slate-300"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Visualizar</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedImageDataUri(null)
                    setSelectedFileName('')
                    setReauthPassword('')
                    setReauthTotp('')
                    setIsUploadModalOpen(true)
                  }}
                  className="h-8 text-xs gap-1.5 border-sky-300 text-[#0E4C92] hover:bg-sky-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Substituir</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReauthPassword('')
                    setReauthTotp('')
                    setIsRemoveModalOpen(true)
                  }}
                  className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedImageDataUri(null)
                  setSelectedFileName('')
                  setReauthPassword('')
                  setReauthTotp('')
                  setIsUploadModalOpen(true)
                }}
                className="h-8 text-xs gap-1.5 bg-[#4A90D9] hover:bg-[#3b7dc2] text-white font-semibold shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Cadastrar Assinatura</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {isLoading ? (
          <div className="py-6 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0E4C92]" />
            <span className="text-xs">Carregando assinatura...</span>
          </div>
        ) : signatureData ? (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-48 h-20 bg-white rounded border border-slate-300 p-1 flex items-center justify-center overflow-hidden shadow-inner">
                {signatureData.imageDataUri ? (
                  <img
                    src={signatureData.imageDataUri}
                    alt="Assinatura manuscrita cadastrada"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 font-mono">Assinatura gravada</span>
                )}
              </div>

              <div className="flex-1 space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Arquivo:</span>
                  <span className="font-mono text-[11px]">{signatureData.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Hash SHA-256:</span>
                  <span className="font-mono text-[10px] break-all text-slate-500">
                    {signatureData.fileHashSha256 || 'Calculado e verificado'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Atualizado em:</span>
                  <span>{new Date(signatureData.updated).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Acesso Restrito:</strong> Sua assinatura é armazenada de forma privada
                (apenas você possui permissão de leitura). Outros médicos e clínicas não têm acesso
                ao arquivo original da imagem.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 border-2 border-dashed border-slate-200 rounded-lg text-center space-y-2">
            <PenTool className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-xs font-semibold text-slate-700">
              Nenhuma assinatura manuscrita cadastrada
            </h4>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Cadastre sua assinatura digitalizada em PNG ou JPEG para que ela seja incorporada
              automaticamente ao rodapé do laudo quando você realizar a aprovação médica definitiva.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setSelectedImageDataUri(null)
                setSelectedFileName('')
                setReauthPassword('')
                setReauthTotp('')
                setIsUploadModalOpen(true)
              }}
              className="mt-2 text-xs bg-[#0E4C92] text-white"
            >
              Cadastrar Assinatura Agora
            </Button>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setSuccessMsg(null)}
            >
              OK
            </Button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-800 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setErrorMsg(null)}
            >
              Fechar
            </Button>
          </div>
        )}
      </CardContent>

      {/* MODAL: CADASTRO / SUBSTITUIÇÃO COM REAUTENTICAÇÃO */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
              <Lock className="w-4 h-4 text-[#0E4C92]" />
              <span>{signatureData ? 'Substituir Assinatura' : 'Cadastrar Assinatura'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Esta é uma operação sensível. A alteração exige reautenticação com senha e segundo
              fator (se habilitado) e será registrada em auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Passo 1: Upload do Arquivo */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">
                1. Selecione a Imagem da Assinatura (PNG ou JPEG) *
              </Label>
              <label className="mt-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-sky-300 rounded-lg bg-sky-50/40 hover:bg-sky-50 cursor-pointer transition-colors">
                <Upload className="w-6 h-6 text-[#0E4C92] mb-1" />
                <span className="text-xs font-semibold text-[#0E4C92]">
                  {selectedFileName || 'Clique para escolher o arquivo'}
                </span>
                <span className="text-[10px] text-slate-400">
                  PNG, JPEG (fundo transparente ou branco recomendado)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {selectedImageDataUri && (
                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                  <img
                    src={selectedImageDataUri}
                    alt="Prévia selecionada"
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>
              )}
            </div>

            {/* Passo 2: Reautenticação Forte */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <KeyRound className="w-4 h-4 text-[#0E4C92]" />
                <span>2. Reautenticação Forte Obrigatória</span>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-700">
                  Sua Senha Atual *
                </Label>
                <Input
                  type="password"
                  placeholder="Confirme sua senha de acesso"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  className="text-xs h-8 mt-1"
                />
              </div>

              {user?.mfa_enabled && (
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span>Código Autenticador TOTP (6 dígitos) *</span>
                    <Badge variant="outline" className="text-[9px] bg-sky-50 text-sky-800">
                      MFA Ativo
                    </Badge>
                  </Label>
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="Ex: 123456"
                    value={reauthTotp}
                    onChange={(e) => setReauthTotp(e.target.value)}
                    className="text-xs h-8 mt-1 font-mono tracking-widest text-center"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSignature}
              disabled={isSubmitting || !selectedImageDataUri || !reauthPassword}
              className="bg-[#0E4C92] hover:bg-[#0c3e77] text-white text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validando e Gravando...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{signatureData ? 'Confirmar Substituição' : 'Confirmar Cadastro'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: REMOÇÃO COM REAUTENTICAÇÃO */}
      <Dialog open={isRemoveModalOpen} onOpenChange={setIsRemoveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-4 h-4" />
              <span>Remover Assinatura Manuscrita</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Ao remover, os futuros laudos preparados não conterão sua assinatura escaneada até que
              você cadastre uma nova.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-900 space-y-1">
              <span className="font-bold">Atenção Médica:</span>
              <p className="text-[11px]">
                A remoção é irreversível e exige sua senha e autenticação em dois fatores para
                prevenir exclusões indevidas.
              </p>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-slate-700">Sua Senha Atual *</Label>
              <Input
                type="password"
                placeholder="Confirme sua senha de acesso"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                className="text-xs h-8 mt-1"
              />
            </div>

            {user?.mfa_enabled && (
              <div>
                <Label className="text-[11px] font-semibold text-slate-700">
                  Código Autenticador TOTP (6 dígitos) *
                </Label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="Ex: 123456"
                  value={reauthTotp}
                  onChange={(e) => setReauthTotp(e.target.value)}
                  className="text-xs h-8 mt-1 font-mono tracking-widest text-center"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRemoveModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleRemoveSignature}
              disabled={isSubmitting || !reauthPassword}
              className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Removendo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar Remoção</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: VISUALIZAÇÃO AMPLIADA */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
              <Eye className="w-4 h-4 text-[#0E4C92]" />
              <span>Assinatura Manuscrita Cadastrada</span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center space-y-4">
            {signatureData?.imageDataUri ? (
              <img
                src={signatureData.imageDataUri}
                alt="Assinatura ampliada"
                className="max-h-36 max-w-full object-contain bg-white p-2 border border-slate-200 rounded shadow-sm"
              />
            ) : (
              <span className="text-xs text-slate-400">Imagem indisponível</span>
            )}

            <div className="text-center text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">{signatureData?.fileName}</p>
              <p className="font-mono text-[10px] text-slate-400 break-all">
                SHA-256: {signatureData?.fileHashSha256}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
