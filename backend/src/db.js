import { Sequelize, DataTypes } from 'sequelize'

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ocri_asistencia',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    timezone: '-05:00',
    logging: process.env.DB_LOG === 'true' ? console.log : false
  }
)

export const Practicante = sequelize.define(
  'Practicante',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    dni: { type: DataTypes.STRING(8), allowNull: false },
    nombre: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    codigo_alumno: { type: DataTypes.STRING, allowNull: false },
    facultad_id: { type: DataTypes.INTEGER, allowNull: false },
    ciclo: { type: DataTypes.STRING, allowNull: true },
    estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVO' }
  },
  {
    tableName: 'practicantes',
    timestamps: false
  }
)

export const Asistencia = sequelize.define(
  'Asistencia',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    practicante_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Practicante, key: 'id' }
    },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hora_entrada: { type: DataTypes.TIME, allowNull: false },
    hora_salida: { type: DataTypes.TIME, allowNull: true },
    estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PENDIENTE' },
    observacion: { type: DataTypes.STRING, allowNull: true }
  },
  {
    tableName: 'asistencias',
    timestamps: false
  }
)

Practicante.hasMany(Asistencia, { foreignKey: 'practicante_id' })
Asistencia.belongsTo(Practicante, { foreignKey: 'practicante_id' })

export default sequelize