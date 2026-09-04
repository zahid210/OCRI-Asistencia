import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderPdfFromHtml } from 'html-pdf-lite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(__dirname, '..', '..', 'templates', 'assets')

const mimeOf = (file) =>
  file.endsWith('.png')
    ? 'image/png'
    : file.endsWith('.svg')
      ? 'image/svg+xml'
      : 'image/jpeg'

function dataUri(file) {
  const pathResolved = path.join(ASSETS, file)
  const base64 = readFileSync(pathResolved).toString('base64')
  return `data:${mimeOf(file)};base64,${base64}`
}

const LOGO_IZQ = dataUri('logo-izquierda.jpeg')
const LOGO_DER = dataUri('logo-derecha.jpeg')

const UNIV_NAME = 'Universidad Nacional del Centro del Perú'
const OFFICE_NAME = 'OCRI - Oficina de Cooperación y Relaciones Internacionales'

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function minutosEntre(entrada, salida) {
  if (!entrada || !salida) return null
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  const total = (sh * 60 + sm) - (eh * 60 + em)
  return total > 0 ? total : null
}

function formatHorasMin(min) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${pad2(m)}m`
}

function formatCiclo(ciclo) {
  if (ciclo === null || ciclo === undefined || String(ciclo).trim() === '') return '—'
  const n = Number(ciclo)
  return Number.isInteger(n) ? String(n) : String(ciclo)
}

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  completa: 'Completa',
  ausente: 'Ausente',
  justificada: 'Justificada'
}

export function buildReporteHtml({ practicante, facultad, asistencias }) {
  let totalMin = 0
  const resumen = { total: asistencias.length, completa: 0, ausente: 0, justificada: 0 }

  const filas = asistencias.map((a, i) => {
    const estado = (a.estado || '').toLowerCase()
    if (ESTADO_LABELS[estado]) resumen[estado] = (resumen[estado] ?? 0) + 1
    const minutos = minutosEntre(a.hora_entrada, a.hora_salida)
    if (minutos) totalMin += minutos
    return `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${formatFecha(a.fecha)}</td>
        <td class="center">${esc(a.hora_entrada ?? '—')}</td>
        <td class="center">${esc(a.hora_salida ?? '—')}</td>
        <td class="center">${formatHorasMin(minutos)}</td>
        <td class="center">${esc(ESTADO_LABELS[estado] ?? a.estado)}</td>
        <td>${esc(a.observacion ?? '')}</td>
      </tr>`
  }).join('\n')

  const facultadNombre = facultad?.nombre ?? practicante?.Facultad?.nombre ?? practicante?.facultad?.nombre ?? '—'
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Asistencia - ${esc(practicante.nombre)} ${esc(practicante.apellidos)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0; background: #ffffff;
    font-family: Helvetica; font-size: 12px; line-height: 1.45; color: #000;
  }
  @page { size: A4; margin: 0; }
  .document {
    padding-top: 25mm; padding-right: 25mm; padding-bottom: 25mm; padding-left: 30mm;
    width: 210mm; box-sizing: border-box;
  }
  .header-table { display: grid; grid-template-columns: 15% 70% 15%; margin-bottom: 10px; }
  .header-logo-left { text-align: left; }
  .header-logo-right { text-align: right; }
  .header-logo-left img, .header-logo-right img { width: 75px; display: block; }
  .header-logo-left img { margin-right: auto; }
  .header-logo-right img { margin-left: auto; }
  .header-text { text-align: center; padding-left: 8px; padding-right: 8px; }
  .univ-name { font-size: 14px; font-weight: bold; margin: 0; }
  .office-name { font-size: 12px; font-weight: bold; margin: 3px 0 0 0; }
  .doc-date { text-align: right; margin-bottom: 14px; padding-right: 10px; font-size: 11px; }
  h2.report-title { text-align: center; font-size: 14px; font-weight: bold; margin: 4px 0 14px 0; text-decoration: underline; }
  .meta { margin-bottom: 12px; font-size: 11px; }
  .meta .row { margin: 1px 0; }
  .meta .label { display: inline-block; min-width: 70px; font-weight: bold; }
  table.report { width: 100%; border-collapse: collapse; font-size: 10px; }
  .report thead th { border: 1px solid #000; padding: 4px 6px; background: #e8e8e8; font-weight: bold; }
  .report tbody td { border: 1px solid #000; padding: 4px 6px; }
  .report .center { text-align: center; }
  .summary { margin-top: 14px; font-size: 11px; }
  .summary .row { margin: 1px 0; }
  .signature-section { margin-top: 70px; }
  .signature-box { text-align: center; margin-top: 8px; }
  .signature-name { font-weight: bold; font-size: 11px; margin: 0; }
  .signature-title { margin: 0; font-size: 11px; }
</style>
</head>
<body>
<div class="document">
  <div class="header-table">
    <div class="header-logo-left"><img src="${LOGO_IZQ}"></div>
    <div class="header-text">
      <p class="univ-name">${esc(UNIV_NAME)}</p>
      <p class="office-name">${esc(OFFICE_NAME)}</p>
    </div>
    <div class="header-logo-right"><img src="${LOGO_DER}"></div>
  </div>
  <div class="doc-date">Fecha de emisión: ${formatFecha(new Date().toISOString())}</div>

  <h2 class="report-title">Reporte de Asistencia</h2>

  <div class="meta">
    <div class="row"><span class="label">Apellidos:</span> ${esc(practicante.apellidos)}</div>
    <div class="row"><span class="label">Nombres:</span> ${esc(practicante.nombre)}</div>
    <div class="row"><span class="label">DNI:</span> ${esc(practicante.dni)}</div>
    <div class="row"><span class="label">Código:</span> ${esc(practicante.codigo_alumno)}</div>
    <div class="row"><span class="label">Facultad:</span> ${esc(facultadNombre)}</div>
    <div class="row"><span class="label">Ciclo:</span> ${formatCiclo(practicante.ciclo)}</div>
    <div class="row"><span class="label">Estado:</span> ${esc(practicante.estado)}</div>
  </div>

  <table class="report">
    <thead>
      <tr>
        <th>#</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Estado</th><th>Observación</th>
      </tr>
    </thead>
    <tbody>
      ${filas || '<tr><td colspan="7" class="center">Sin asistencias registradas.</td></tr>'}
    </tbody>
  </table>

  <div class="summary">
    <div class="row"><span class="label">Total de registros:</span> ${resumen.total}</div>
    <div class="row"><span class="label">Asistencia completa:</span> ${resumen.completa}</div>
    <div class="row"><span class="label">Ausente:</span> ${resumen.ausente}</div>
    <div class="row"><span class="label">Justificada:</span> ${resumen.justificada}</div>
    <div class="row"><span class="label">Total de horas:</span> ${formatHorasMin(totalMin)}</div>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-line"></div>
      <p class="signature-name">____________________________</p>
      <p class="signature-name">Ana María Huaycachuco Ruiz</p>
      <p class="signature-title">Jefe de Cooperación y Relaciones Internacionales</p>
    </div>
  </div>
</div>
</body>
</html>`
}

export async function renderReportePdf(datos) {
  const html = buildReporteHtml(datos)
  return renderPdfFromHtml(html, { loadTimeoutMs: 15000 })
}