# ADR-0005 — Licencia del proyecto

**Estado:** ⏳ **Abierta con recomendación** — análisis del 2026-09-27; requiere confirmación del
sponsor para cerrarse. Bloquea la publicación del repo en GitHub.

## Contexto

Distribución vía GitHub con **una instalación independiente por empresa** (ADR-0002): el negocio
es la implantación y el soporte, no un SaaS central. Eso cambia por completo qué protección
sirve y cuál estorba.

**Aclaración previa que suele pasarse por alto** (corrige una lectura equivocada del análisis de
activos): la licencia de los proyectos locales **no obliga** a elegir AGPL. `activos-reutilizables.md`
§5 ya prescribe **re-implementar** el diseño de los activos AGPL en vez de copiar su código, y eso
es legítimo bajo cualquier licencia, porque el derecho de autor protege la *expresión*, no las
*ideas*. Solo **copiar** código AGPL obligaría a AGPL. Como la decisión ya tomada es re-implementar,
la licencia es una **elección de negocio**, no una restricción legal. (`data/ve/*.json` son datos
públicos: libres en cualquier caso.)

## Opciones

| Licencia | Tipo | A favor | En contra |
|---|---|---|---|
| **AGPL-3.0-only** | Copyleft fuerte + red | Protege contra el fork cerrado que se vende a otra empresa; **no afecta al instalador** que usa el software internamente; coherente con el resto del trabajo del sponsor | Política interna de algunas empresas la rechaza; estorba si algún día se quiere un módulo propietario |
| **GPL-3.0-only** | Copyleft fuerte | Más aceptada que AGPL en entornos corporativos y públicos | **No cubre el uso en red**: alguien puede tomar el código, modificarlo y ofrecerlo como SaaS sin publicar nada |
| **Apache-2.0** | Permisiva | Concesión explícita de patentes; máxima adopción; sin fricción en licitaciones públicas | Permite un fork cerrado y un SaaS propietario sobre el código |
| **MIT** | Permisiva | La más simple y conocida | Sin concesión de patentes (Apache-2.0 es mejor si se va por aquí) |
| **MPL-2.0** | Copylet por archivo | El núcleo sigue abierto y los *plugins* pueden ser propietarios | Copylet débil: alguien puede tomar todo el archivo y cerrar el proyecto |
| **Doble licencia** (AGPL-3.0-only **o** Licencia Comercial) | Combinación | Permite vender una versión con garantías y SLA sin perder la apertura del núcleo | Exige ser titular único de los derechos o tener un **CLA** firmado por cada colaborador |

## Cómo se comporta cada una en ESTE proyecto

El punto que suele decidir la elección, y que es contraintuitivo:

> **Para un producto estrictamente auto-alojado, la cláusula de red de la AGPL no perjudica a
> quien instala el software.** El cliente que descarga el código ya lo tiene; instalar y usar
> internamente no es distribuir. Lo que la AGPL sí impide es que **alguien modifique el código y
> lo ofrezca como servicio** sin publicar sus cambios. Es decir, protege al sponsor frente a
> terceros, y no castiga a sus propios clientes.

Consecuencias prácticas de esa lectura:

- **El instalador privado no tiene ninguna obligación** con AGPL: ni publicar, ni abrir sus
  datos, ni nada. El sponsor puede cobrar la implantación sin condiciones.
- **El instalador público tampoco.** Un estado o empresa que clone el repo y lo modifique debe
  ofrecer el código modificado a quien lo use por red.
- **Por tanto la AGPL no le cuesta nada a la clientela**, salvo por políticas internas que la prohíban
  (motivo real y suficiente, pero de compras, no legal).
- **Si el negocio fuese un SaaS hospedado por el propio sponsor**, la AGPL le obligaría a sí
  mismo a publicar. Como el modelo es instalación por empresa, no aplica hoy.

### El riesgo que sí hay que nombrar

El mercado venezolano es pequeño y el escenario de amenaza realista no es una startup: es **otra
empresa de RRHH o de software que forked el proyecto, le cambia el nombre, lo comercializa y no
publica sus mejoras**. Contra eso:
- **MIT/Apache-2.0** no protegen nada.
- **GPL-3.0** protege solo si distribuyen el binario o el código, no si lo ofrecen por red.
- **AGPL-3.0** es la que cubre específicamente ese caso.

### El factor sector público

`companies.sector` incluye el sector público como bandera, y las entidades públicas suelen tener
reglas de compra que desconfían del copyleft fuerte. Si el sponsor apunta de verdad a ese mercado,
AGPL puede convertirse en un freno de/licitación. **Apache-2.0** es el punto de equilibrio
razonable en ese escenario: adopción máxima con concesión de patentes. Esto es una pregunta de
estrategia comercial, no de ingeniería.

### La doble licencia, en su lugar real

La doble licencia (AGPL **o** Comercial) tiene sentido **solo** si existe intención de vender una
versión cerrada con soporte garantizado y SLA. Exige poder conceder la licencia comercial, es
decir, **titularidad única del copyright o un CLA** firmado por todos los colaboradores. Hoy el
proyecto es de un solo autor, así que es viable sin fricción; si se aceptan contribuciones
externas, hay que montar el CLA desde el primer commit, no después.

## Recomendación

**AGPL-3.0-only**, por estos motivos, en orden de peso:

1. El modelo es una instalación por empresa: el instalador no paga nada por la copyleft, así que
   la adopción no se sacrifica en el cliente real.
2. El riesgo que resta (un fork cerrado vendido a otra empresa venezolana) es real en un mercado
   pequeño, y AGPL es la única de las opciones simples que lo cubre.
3. Es coherente con el resto del trabajo del sponsor, lo que evita mantener dos criterios.

**Con una condición explícita:** si el sector público se convierte en un pipeline real y la
licitación excluye el copyleft fuerte, **Apache-2.0** es el repliegue, y el coste es asumir
la pérdida de la protección del punto 2 —aceptable, porque un competidor que forked en el sector
privado no es el mismo cliente que uno que gana una licitación pública.

**No recomiendo** combinar un núcleo AGPL con módulos propietarios: duplica el mantenimiento y
contradice la simplicidad de la instalación auto-alojada (ADR-0002). Si algún día hiciera falta,
la vía limpia es la doble licencia, no un núcleo partido.

## Estado mientras se decide

- El repo **no se publica** en GitHub y `package.json` declara
  `SEE LICENSE IN docs/decisiones/0005-licencia.md`.
- Cuando se cierre: añadir el texto de la licencia como `LICENSE` en la raíz, poner
  `license` en `package.json`, actualizar esta tabla a "Aceptada" y dejar constancia de la
  decisión en `README.md`.
- **Si el proyecto acepta contribuciones externas, firmar un CLA antes del primer commit
  aceptado**, para no perder la posibilidad de la doble licencia.

## Consecuencias

- Con AGPL: no se puede ofrecer una versión cerrada sin abrirla; no se pueden añadir módulos
  propietarios sin contradecir la licencia; la re-implementación de activos externos sigue
  siendo obligatoria (los datos y las ideas no están afectados).
- Con Apache-2.0/MIT: se puede vender una versión modificada y cerrada, a cambio de perder la
  protección frente a forks propietarios.

## Nota ajena a la licencia: responsabilidad del cálculo

Ninguna licencia exime de responsabilidad por un cálculo de nómina incorrecto, y ninguna
selección de licencia reduce ese riesgo por sí sola. La mitigación es de producto y ya está
prevista: los parámetros legales son **datos con vigencia y fuente** (`rate_tables`/`rule_sets`),
la corrida de nómina es **reproducible** renglón por renglón (ADR-0009) y los criterios de
aceptación de M2 exigen **calibración de fórmulas con un contador**. La instalación debe además
declarar de forma explícita, en el primer arranque, que la validación de los parámetros legales
corresponde al contador de la empresa.
