'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Remota', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      pid: {
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      device_ip: {
        type: Sequelize.STRING
      },
      device_port: {
        type: Sequelize.INTEGER
      },
      mestra_ip: {
        type: Sequelize.STRING
      },
      mestra_port: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Remota');
  }
};