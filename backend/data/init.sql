-- Limpiar tablas (respetando claves foráneas: asistencias -> practicantes -> facultades)
DELETE FROM asistencias;
DELETE FROM practicantes;
DELETE FROM facultades;

-- Reiniciar contadores AUTO_INCREMENT
ALTER TABLE asistencias AUTO_INCREMENT = 1;
ALTER TABLE practicantes AUTO_INCREMENT = 1;
ALTER TABLE facultades AUTO_INCREMENT = 1;

-- Insertar facultad
INSERT INTO facultades (nombre, abreviatura)
VALUES ('Ingenieria de Sistemas', NULL);

-- Capturar el id generado de la facultad
SET @fac_id = LAST_INSERT_ID();

-- Insertar practicante de prueba
INSERT INTO practicantes (dni, nombre, apellidos, codigo_alumno, facultad_id, ciclo, estado)
VALUES ('75186439', 'Zahid Roy', 'Matos Ceras', '2022200420G', @fac_id, 8, 'ACTIVO');