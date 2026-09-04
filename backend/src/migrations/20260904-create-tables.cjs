'use strict'

const { DataTypes } = require('sequelize')

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables()
  return tables.includes(name)
}

module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'facultades'))) {
      await queryInterface.createTable('facultades', {
        id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
        nombre: { type: DataTypes.STRING(150), allowNull: false, unique: 'uq_facultad_nombre' },
        abreviatura: { type: DataTypes.STRING(20), allowNull: true, unique: 'uq_facultad_abreviatura' },
        estado: { type: DataTypes.ENUM('ACTIVO', 'INACTIVO'), allowNull: false, defaultValue: 'ACTIVO' },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      })
    }

    if (!(await tableExists(queryInterface, 'practicantes'))) {
      await queryInterface.createTable('practicantes', {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        dni: { type: DataTypes.CHAR(8), allowNull: false, unique: 'uq_practicante_dni' },
        nombre: { type: DataTypes.STRING(100), allowNull: false },
        apellidos: { type: DataTypes.STRING(150), allowNull: false },
        codigo_alumno: { type: DataTypes.STRING(11), allowNull: false, unique: 'uq_practicante_codigo' },
        facultad_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'facultades', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        ciclo: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
        estado: {
          type: DataTypes.ENUM('ACTIVO', 'INACTIVO', 'EGRESADO', 'RETIRADO'),
          allowNull: false,
          defaultValue: 'ACTIVO'
        },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      })
    }

    if (!(await tableExists(queryInterface, 'asistencias'))) {
      await queryInterface.createTable(
        'asistencias',
        {
          id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
          practicante_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'practicantes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
          },
          fecha: { type: DataTypes.DATEONLY, allowNull: false },
          hora_entrada: { type: DataTypes.TIME, allowNull: true },
          hora_salida: { type: DataTypes.TIME, allowNull: true },
          estado: {
            type: DataTypes.ENUM('PENDIENTE', 'COMPLETA', 'AUSENTE', 'JUSTIFICADA'),
            allowNull: false,
            defaultValue: 'PENDIENTE'
          },
          observacion: { type: DataTypes.STRING(500), allowNull: true },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false }
        },
        {
          indexes: [
            { name: 'uq_asistencia_diaria', unique: true, fields: ['practicante_id', 'fecha'] }
          ]
        }
      )
    }

    if (!(await tableExists(queryInterface, 'trabajadores'))) {
      await queryInterface.createTable('trabajadores', {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        dni: { type: DataTypes.CHAR(8), allowNull: false, unique: 'uq_trabajador_dni' },
        nombre: { type: DataTypes.STRING(100), allowNull: false },
        apellidos: { type: DataTypes.STRING(150), allowNull: false },
        codigo_trabajador: { type: DataTypes.STRING(30), allowNull: true, unique: 'uq_trabajador_codigo' },
        cargo: { type: DataTypes.STRING(100), allowNull: true },
        area: { type: DataTypes.STRING(150), allowNull: true },
        estado: { type: DataTypes.ENUM('ACTIVO', 'INACTIVO'), allowNull: false, defaultValue: 'ACTIVO' },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      })
    }

    if (!(await tableExists(queryInterface, 'usuarios'))) {
      await queryInterface.createTable('usuarios', {
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
        trabajador_id: {
          type: DataTypes.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'trabajadores', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        usuario: { type: DataTypes.STRING(50), allowNull: false, unique: 'uq_usuario' },
        password_hash: { type: DataTypes.STRING(255), allowNull: false },
        rol: {
          type: DataTypes.ENUM('ADMIN', 'COORDINADOR', 'SUPERVISOR'),
          allowNull: false,
          defaultValue: 'SUPERVISOR'
        },
        estado: { type: DataTypes.ENUM('ACTIVO', 'INACTIVO'), allowNull: false, defaultValue: 'ACTIVO' },
        ultimo_acceso: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuarios')
    await queryInterface.dropTable('trabajadores')
    await queryInterface.dropTable('asistencias')
    await queryInterface.dropTable('practicantes')
    await queryInterface.dropTable('facultades')
  }
}