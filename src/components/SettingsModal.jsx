import { useState, useEffect } from 'react'

const DEFAULT_PARAMS = {
  temperature: 0.8,
  top_k: 40,
  top_p: 0.9,
  num_ctx: 2048,
  repeat_penalty: 1.1,
  num_predict: -1,
}

const PARAM_INFO = {
  temperature: { label: 'Temperature', min: 0, max: 2, step: 0.1, desc: 'Creatividad. Bajo = preciso, Alto = creativo' },
  top_k: { label: 'Top K', min: 1, max: 100, step: 1, desc: 'Limita tokens posibles por paso' },
  top_p: { label: 'Top P', min: 0, max: 1, step: 0.05, desc: 'Muestreo por núcleo' },
  num_ctx: { label: 'Context Window', min: 512, max: 32768, step: 512, desc: 'Tamaño del contexto en tokens' },
  repeat_penalty: { label: 'Repeat Penalty', min: 1, max: 2, step: 0.1, desc: 'Penaliza repeticiones' },
  num_predict: { label: 'Max Tokens', min: -1, max: 4096, step: 64, desc: 'Max tokens a generar (-1 = sin límite)' },
}

export default function SettingsModal({ isOpen, onClose, params, onParamsChange }) {
  const [localParams, setLocalParams] = useState({ ...DEFAULT_PARAMS, ...params })

  useEffect(() => {
    setLocalParams({ ...DEFAULT_PARAMS, ...params })
  }, [params, isOpen])

  const handleChange = (key, value) => {
    setLocalParams(prev => ({ ...prev, [key]: Number(value) }))
  }

  const handleSave = () => {
    onParamsChange(localParams)
    onClose()
  }

  const handleReset = () => {
    setLocalParams({ ...DEFAULT_PARAMS })
    onParamsChange({ ...DEFAULT_PARAMS })
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Configuración de Parámetros</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {Object.entries(PARAM_INFO).map(([key, info]) => (
            <div key={key} className="param-row">
              <div className="param-header">
                <label className="param-label">{info.label}</label>
                <span className="param-value">{localParams[key]}</span>
              </div>
              <p className="param-desc">{info.desc}</p>
              <input
                type="range"
                className="param-slider"
                min={info.min}
                max={info.max}
                step={info.step}
                value={localParams[key]}
                onChange={e => handleChange(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="modal-btn reset" onClick={handleReset}>Restablecer</button>
          <button className="modal-btn cancel" onClick={onClose}>Cancelar</button>
          <button className="modal-btn save" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
