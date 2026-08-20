export const LIMITS = {
  nombre: 100,
  apellidos: 150,
  codigo_alumno: 30,
  codigo_trabajador: 30,
  abreviatura: 20,
  cargo: 100,
  area: 150,
  usuario: 50,
  password: { min: 6, max: 72 }
}

export const ENUMS = {
  facultadEstado: ['ACTIVO', 'INACTIVO'],
  practicanteEstado: ['ACTIVO', 'INACTIVO', 'EGRESADO', 'RETIRADO'],
  trabajadorEstado: ['ACTIVO', 'INACTIVO'],
  usuarioEstado: ['ACTIVO', 'INACTIVO'],
  usuarioRol: ['ADMIN', 'COORDINADOR', 'SUPERVISOR']
}

export function isDni(value) {
  return /^\d{8}$/.test(String(value ?? ''))
}

export function isCiclo(value) {
  if (value == null || value === '') return true
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 10
}

export function toCiclo(value) {
  if (value == null || value === '') return null
  return Number(value)
}

export function isInEnum(allowed, value) {
  return value == null || allowed.includes(value)
}

export function lengthError(label, value, max) {
  const v = String(value ?? '')
  if (v.length > max) return `${label} no puede superar ${max} caracteres.`
  return null
}

export function passwordError(value) {
  const v = String(value ?? '')
  if (v.length < LIMITS.password.min) {
    return `La contraseña debe tener al menos ${LIMITS.password.min} caracteres.`
  }
  if (v.length > LIMITS.password.max) {
    return `La contraseña no puede superar ${LIMITS.password.max} caracteres.`
  }
  return null
}

export function trimOrNull(value) {
  const v = String(value ?? '').trim()
  return v === '' ? null : v
}