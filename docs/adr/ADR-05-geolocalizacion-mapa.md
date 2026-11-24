# ADR-05: Geolocalizacion y visualizacion en mapa

**Estado:** Aceptado

## Requerimientos relacionados

RF-08, RF-13, RNF-01, S-02.

## Contexto

La evidencia geografica se captura en el dispositivo y debe poder consultarse posteriormente, incluso cuando la captura inicial ocurre sin internet.

## Stack y decision

- `expo-location` para obtener coordenadas.
- Calculo de distancias Haversine para comparacion geografica.
- React Native WebView para mostrar el mapa.

## Ventajas y desventajas

- Las coordenadas GPS se pueden obtener sin una conexion de datos.
- El mapa puede requerir conectividad para cargar su contenido.
- El uso de ubicacion puede incrementar consumo de bateria.

## Consecuencias

- El mapa y la captura de ubicacion tienen dependencias de conectividad diferentes.
- El uso de la ubicacion puede afectar bateria y rendimiento.
