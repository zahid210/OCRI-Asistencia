import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ocri_asistencia',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}

export const pool = mysql.createPool(dbConfig)

export async function findPractitionerByDni(dni) {
  const [rows] = await pool.query(
    'SELECT id, dni, nombre, apellidos, codigo_alumno, facultad_id, ciclo, estado FROM practicantes WHERE dni = ? AND estado = \'ACTIVO\'',
    [dni]
  )
  return rows.length > 0 ? rows[0] : null
}

export async function createAttendance(practitionerId, fecha, horaEntrada) {
  const [result] = await pool.query(
    'INSERT INTO asistencias (practicante_id, fecha, hora_entrada, estado) VALUES (?, ?, ?, \'PENDIENTE\')',
    [practitionerId, fecha, horaEntrada]
  )
  return result
}