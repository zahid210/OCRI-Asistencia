'use strict'

const { DataTypes } = require('sequelize')

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables()
    if (tables.includes('practicantes')) {
      await queryInterface.changeColumn('practicantes', 'codigo_alumno', {
        type: DataTypes.STRING(11),
        allowNull: false
      })
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables()
    if (tables.includes('practicantes')) {
      await queryInterface.changeColumn('practicantes', 'codigo_alumno', {
        type: DataTypes.STRING(30),
        allowNull: false
      })
    }
  }
}