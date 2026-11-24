# FEAT-04: Sincronizacion, correcciones y auditoria

**Estado:** Implementada  
**Depende de:** FEAT-03  
**Requerimientos:** RF-10, RF-11, RF-12, RNF-01, RNF-02, RNF-03  
**ADR:** ADR-01, ADR-02, ADR-03, ADR-06  
**Supuestos:** S-03, S-04, S-06

## Encargo para la IA

Completa el procesamiento durable de la cola offline y el ciclo de correccion. Implementa las fases acordadas, reintentos, estados, avisos dentro de la aplicacion y registro auditable de cambios. No agregues un scheduler o dependencia que no este aprobada.

## Criterios de aceptacion

- Usa los estados de acta del esquema: `draft`, `pending`, `processing_ocr`, `ready`, `sending`, `sent` y `failed`; conserva el motivo/etapa del error suficiente para reintentar la fase correcta.
- Los trabajos pendientes sobreviven reinicios y los reintentos no crean actas duplicadas. `failure_stage` identifica si debe reintentarse OCR o envio.
- Cada revision completa se persiste atomica mediante `save_acta_revision`, incluyendo acta y cinco candidaturas; el cliente no escribe directamente esas tablas. `submit_acta` valida y confirma el envio.
- OCR y sincronizacion tienen estados distinguibles. Un error se puede reintentar sin perder la imagen ni los datos revisados.
- La autorizacion humana de envio se persiste localmente y la cola no envia borradores sin autorizacion.
- Los avisos de revision, envio y fallo se muestran dentro de la aplicacion, sin notificaciones del sistema ni dependencias nuevas.
- El veedor corrige sus mesas y el coordinador corrige las actas de su recinto; cada cambio conserva autor, hora de dispositivo y hora de recepcion del servidor.
- Los conflictos siguen S-03. Si dos cambios tienen la misma marca temporal, no se inventa un desempate silencioso: se informa como decision pendiente.
- Se prueban desconexion, reconexion, error de red, reintento, edicion concurrente, auditoria y acceso no autorizado.
- Se prueba ejecucion en segundo plano con APK EAS; Android puede diferir los trabajos.
- La integracion nativa de Crashlytics y la validacion del APK se completan en FEAT-05, que concentra la observabilidad y entrega Android.

## Estados de sincronizacion

- `draft`: acta en edicion local.
- `pending`: guardada localmente y pendiente de procesamiento.
- `processing_ocr`: OCR en curso.
- `ready`: OCR finalizado; requiere revision del veedor.
- `sending`: envio autorizado en curso.
- `sent`: Supabase confirmo el envio.
- `failed`: la fase indicada por `failure_stage` fallo; se conserva el acta para reintento.

Al corregir un acta ya enviada, se vuelve a `pending` antes de modificar votos o fotografia y se repite la validacion al enviarla nuevamente. La fotografia de un acta `sent` no se puede reemplazar ni borrar directamente.

## Verificacion

Completar el recorrido de una acta pendiente hasta sincronizada, corregirla desde cada rol permitido y revisar el historial. Simular reintento y confirmar que no se duplica.
