import { Sequelize, DataTypes } from 'sequelize'
import { registrarDesdeHook } from './services/auditoriaService.js'

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ocri_asistencia',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    timezone: '-05:00',
    logging: process.env.DB_LOG === 'true' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  }
)

export const Facultad = sequelize.define(
  'Facultad',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false, unique: 'uq_facultad_nombre' },
    abreviatura: { type: DataTypes.STRING(20), allowNull: true, unique: 'uq_facultad_abreviatura' },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO'
    }
  },
  {
    tableName: 'facultades'
  }
)

export const Practicante = sequelize.define(
  'Practicante',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    dni: { type: DataTypes.CHAR(8), allowNull: false, unique: 'uq_practicante_dni' },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    apellidos: { type: DataTypes.STRING(150), allowNull: false },
    codigo_alumno: {
      type: DataTypes.STRING(11),
      allowNull: false,
      unique: 'uq_practicante_codigo'
    },
    facultad_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    ciclo: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true,
      validate: { min: 1, max: 10 }
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO', 'EGRESADO', 'RETIRADO'),
      allowNull: false,
      defaultValue: 'ACTIVO'
    }
  },
  {
    tableName: 'practicantes'
  }
)

export const Asistencia = sequelize.define(
  'Asistencia',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    practicante_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hora_entrada: { type: DataTypes.TIME, allowNull: true },
    hora_salida: { type: DataTypes.TIME, allowNull: true },
    estado: {
      type: DataTypes.ENUM('PENDIENTE', 'COMPLETA', 'AUSENTE', 'JUSTIFICADA'),
      allowNull: false,
      defaultValue: 'PENDIENTE'
    },
    observacion: { type: DataTypes.STRING(500), allowNull: true }
  },
  {
    tableName: 'asistencias',
    indexes: [
      {
        name: 'uq_asistencia_diaria',
        unique: true,
        fields: ['practicante_id', 'fecha']
      }
    ]
  }
)

export const Trabajador = sequelize.define(
  'Trabajador',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    dni: { type: DataTypes.CHAR(8), allowNull: false, unique: 'uq_trabajador_dni' },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    apellidos: { type: DataTypes.STRING(150), allowNull: false },
    codigo_trabajador: {
      type: DataTypes.STRING(30),
      allowNull: true,
      unique: 'uq_trabajador_codigo'
    },
    cargo: { type: DataTypes.STRING(100), allowNull: true },
    area: { type: DataTypes.STRING(150), allowNull: true },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO'
    }
  },
  {
    tableName: 'trabajadores'
  }
)

export const Usuario = sequelize.define(
  'Usuario',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    trabajador_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    usuario: { type: DataTypes.STRING(50), allowNull: false, unique: 'uq_usuario' },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    rol: {
      type: DataTypes.ENUM('ADMIN', 'COORDINADOR', 'SUPERVISOR'),
      allowNull: false,
      defaultValue: 'SUPERVISOR'
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO'
    },
    ultimo_acceso: { type: DataTypes.DATE, allowNull: true },
    locked_until: { type: DataTypes.DATE, allowNull: true }
  },
  {
    tableName: 'usuarios'
  }
)

export const Auditoria = sequelize.define(
  'Auditoria',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    usuario: { type: DataTypes.STRING(50), allowNull: true },
    usuario_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    rol: { type: DataTypes.STRING(20), allowNull: true },
    entidad: { type: DataTypes.STRING(50), allowNull: false },
    entidad_id: { type: DataTypes.STRING(64), allowNull: true },
    accion: { type: DataTypes.STRING(30), allowNull: false },
    descripcion: { type: DataTypes.STRING(500), allowNull: true },
    antes: { type: DataTypes.JSON, allowNull: true },
    despues: { type: DataTypes.JSON, allowNull: true },
    origen: {
      type: DataTypes.ENUM('manual', 'auto'),
      allowNull: false,
      defaultValue: 'manual'
    },
    ip: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.STRING(255), allowNull: true }
  },
  {
    tableName: 'auditorias',
    indexes: [
      { name: 'idx_aud_created', fields: ['created_at'] },
      { name: 'idx_aud_entidad', fields: ['entidad', 'entidad_id'] },
      { name: 'idx_aud_usuario', fields: ['usuario'] },
      { name: 'idx_aud_accion', fields: ['accion'] },
      { name: 'idx_aud_origen', fields: ['origen'] }
    ]
  }
)

Facultad.hasMany(Practicante, {
  foreignKey: 'facultad_id',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
})
Practicante.belongsTo(Facultad, {
  foreignKey: 'facultad_id',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
})

Practicante.hasMany(Asistencia, {
  foreignKey: 'practicante_id',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
})
Asistencia.belongsTo(Practicante, {
  foreignKey: 'practicante_id',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
})

Trabajador.hasMany(Usuario, {
  foreignKey: 'trabajador_id',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
})
Usuario.belongsTo(Trabajador, {
  foreignKey: 'trabajador_id',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
})

for (const model of [Facultad, Practicante, Asistencia, Trabajador, Usuario]) {
  model.addHook('afterCreate', 'auditoria', (instance) => registrarDesdeHook(instance, 'CREATE'))
  model.addHook('afterUpdate', 'auditoria', (instance) => registrarDesdeHook(instance, 'UPDATE'))
  model.addHook('afterDestroy', 'auditoria', (instance) => registrarDesdeHook(instance, 'DELETE'))
}

export default sequelize