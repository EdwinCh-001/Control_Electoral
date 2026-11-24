# FEAT-03: Captura, validacion y revision de actas

**Estado:** Pendiente  
**Depende de:** FEAT-01 y FEAT-02  
**Requerimientos:** RF-07, RF-08, RF-09, RF-10, RNF-01  
**ADR:** ADR-02, ADR-04, ADR-05, ADR-07  
**Supuestos:** S-01, S-02, S-06

## Encargo para la IA

Implementa desde una mesa asignada el recorrido completo de captura para alcaldia y prefectura: formulario, fotografia, control local de nitidez, ubicacion, guardado offline, OCR asistido y revision humana antes de autorizar el envio.

## Criterios de aceptacion

- Se registran las cinco candidaturas, votos blancos, votos nulos y sufragantes; S-01 se valida con casos que cuadran y que no cuadran.
- Solo se acepta una fotografia tomada con la camara. La imagen borrosa se bloquea localmente; el umbral debe ser configurable y no se inventa sin calibracion.
- La ubicacion queda asociada al acta, mesa y recinto. Se aplica S-02: primera foto de referencia por recinto, aviso si una posterior supera 300 m, sin bloquear.
- La respuesta Gemini completa los campos legibles y deja los ilegibles editables/nulos. El veedor revisa y autoriza; OCR no envia por si solo.
- En modo avion, los datos y la foto quedan pendientes y sobreviven al cierre/reapertura. Al recuperar conexion puede comenzar el OCR y se informa el resultado al veedor.
- Se muestran estados y errores de forma clara. Los datos de prueba son fixtures, no datos electorales ficticios de produccion.

## Verificacion

Probar ambas dignidades, cuadre positivo/negativo, permiso de camara, imagen nitida/borrosa, GPS dentro/fuera de rango, OCR con campos ilegibles y persistencia offline. Si falta calibracion real de nitidez, reportarla sin escoger un umbral arbitrario.
