# Supuestos y aclaraciones del proyecto

| ID | Ambiguedad | Supuesto adoptado |
|---|---|---|
| S-01 | El enunciado pide detectar sumas incorrectas; el equipo acordo una regla estricta. | El total de sufragantes debe ser exactamente igual a la suma de votos de las cinco candidaturas, votos blancos y votos nulos. Se elimino la excepcion de papeletas no utilizadas. |
| S-02 | No hay coordenadas precargadas de recintos y una ubicacion lejana no debe impedir el registro. | La fotografia con la hora de captura del dispositivo mas temprana establece la referencia geografica, independientemente del orden de sincronizacion. Las fotos de actas posteriores de mesas asignadas a ese mismo recinto se comparan con ella mediante Haversine; una distancia superior a 300 m genera aviso, nunca bloquea el registro. Si dos actas tienen la misma hora de captura, se requiere revision sin desempate automatico. Cada ubicacion permanece asociada al acta, mesa y recinto, aunque cambie el veedor. |
| S-03 | Dos usuarios pueden editar la misma acta sin conexion. | Prevalece la modificacion con la hora mas reciente del dispositivo (Last-Write-Wins). Se guarda tambien la hora de recepcion del servidor para auditoria. Un reloj incorrecto puede hacer prevalecer una modificacion anterior. |
| S-04 | Una mesa puede cambiar de veedor despues de registrar actas. | Las actas conservan el autor original. El nuevo veedor recibe acceso a las actas de las mesas que se le asignen para completar o corregir su registro. |
| S-05 | Una persona externa puede reemplazar a un veedor el mismo dia. | Las cuentas se crean y activan antes de la jornada siempre que sea posible. Para un reemplazo externo imprevisto se requiere conexion breve para crear su cuenta, confirmar el correo y cambiar la clave temporal; el coordinador puede compartir conectividad. Despues, la persona puede operar offline. No se conserva la clave en texto plano en el dispositivo. |
| S-06 | El OCR podria confundirse con un resultado aprobado. | OCR nunca autoriza el envio. El acta requiere revision humana, correccion de valores ilegibles, validacion aritmetica y autorizacion del veedor. |

## Datos y parametros aun no seleccionados

- Provincia, canton, recintos, mesas y candidaturas reales: se cargaran posteriormente; no usar datos ficticios como datos de produccion.
- El umbral y la calibracion de nitidez requieren pruebas con fotografias reales; no se fija un algoritmo adicional en esta especificacion.
- No se ha seleccionado proveedor SMTP, proveedor de mapas ni modelo/version de Gemini.
- No se ha seleccionado una herramienta adicional para garantizar la ejecucion inmediata de tareas Android en segundo plano. No agregarla sin decision aprobada; Android puede aplazar trabajos.
- S-03 no define un desempate cuando dos cambios tienen exactamente la misma hora de dispositivo; resolverlo requiere una decision, no una regla asumida por la IA.
- La configuracion y credenciales de los servicios externos se proporcionaran fuera del repositorio y no se incluiran en documentos ni codigo.
