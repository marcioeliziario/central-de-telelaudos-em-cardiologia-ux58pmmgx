import React from 'react'

interface BrandLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  layout?: 'horizontal' | 'vertical'
  theme?: 'dark' | 'light' | 'auto'
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  layout = 'horizontal',
  theme = 'auto',
}) => {
  const sizeMap = {
    sm: { symbol: 32, fontTitle: 'text-xs', fontSub: 'text-[9px]' },
    md: { symbol: 42, fontTitle: 'text-sm font-bold', fontSub: 'text-[10px]' },
    lg: { symbol: 56, fontTitle: 'text-base font-bold', fontSub: 'text-xs' },
    xl: { symbol: 72, fontTitle: 'text-xl font-bold', fontSub: 'text-xs' },
  }

  const currentSize = sizeMap[size]

  return (
    <div
      className={`inline-flex ${
        layout === 'vertical' ? 'flex-col items-center text-center' : 'items-center gap-3'
      } ${className}`}
    >
      {/* Monograma com traçado de ECG e anel estilizado */}
      <svg
        width={currentSize.symbol}
        height={currentSize.symbol}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform group-hover:scale-105"
        aria-label="Monograma Márcio Eliziário"
      >
        {/* Círculo com abertura no estilo da logomarca */}
        <circle
          cx="50"
          cy="50"
          r="42"
          stroke="#4A90D9"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="210 50"
          strokeDashoffset="15"
        />

        {/* Ponto terminal superior direito (acabamento estetoscópio/ECG) */}
        <circle cx="82" cy="30" r="3" fill="#2F3942" />
        <circle cx="82" cy="30" r="1.5" fill="#4A90D9" />

        {/* Linha horizontal inicial de ECG à esquerda */}
        <path d="M 8 50 L 26 50" stroke="#2F3942" strokeWidth="3.2" strokeLinecap="round" />

        {/* Traçado de ECG que forma a letra 'M' central */}
        <path
          d="M 26 50 L 33 50 L 40 26 L 47 48 L 54 30 L 60 62 L 60 70"
          stroke="#2F3942"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Barra horizontal estendida da base do monograma */}
        <path d="M 52 64 L 88 64" stroke="#2F3942" strokeWidth="3.2" strokeLinecap="round" />

        {/* Letra 'E' caligráfica cursiva em azul sobrepondo o monograma */}
        <path
          d="M 44 72 C 38 72 34 68 37 60 C 40 52 50 48 64 45 C 72 43 78 41 84 38"
          stroke="#4A90D9"
          strokeWidth="3.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 62 45 C 55 46 48 50 45 56 C 41 62 43 68 49 68 C 55 68 64 63 76 56"
          stroke="#4A90D9"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Pequeno gancho inferior que estiliza a terminação de estetoscópio */}
        <path
          d="M 72 74 C 76 77 82 76 84 70 C 85 66 82 63 78 63"
          stroke="#2F3942"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Tipografia Oficial da Logomarca */}
      {showText && (
        <div
          className={`flex flex-col ${
            layout === 'vertical' ? 'items-center mt-2' : 'justify-center min-w-0'
          }`}
        >
          <span
            className={`${currentSize.fontTitle} tracking-wider font-extrabold uppercase leading-tight ${
              theme === 'light' ? 'text-white' : 'text-[#2F3942]'
            }`}
            style={{ letterSpacing: '0.08em' }}
          >
            Márcio Eliziário
          </span>
          <span
            className={`${currentSize.fontSub} font-medium tracking-normal leading-snug ${
              theme === 'light' ? 'text-slate-200' : 'text-[#6F7780]'
            }`}
          >
            Clínica Médica e Cardiologia
          </span>
        </div>
      )}
    </div>
  )
}

export default BrandLogo
