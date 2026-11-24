import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { useAppSelector } from "../../../app/store";
import { territoryRepository } from "../data";
import type {
  TerritoryManagement,
  TerritoryPerson,
} from "../domain/territory";
import {
  AuthPage,
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../../access/presentation/components/AuthUi";

type Props = NativeStackScreenProps<RootStackParamList, "TerritoryManagement">;

const precinctSchema = z.object({
  parish: z.string().trim().min(1, "Ingresa la parroquia."),
  name: z.string().trim().min(1, "Ingresa el nombre del recinto."),
});

type PrecinctValues = z.infer<typeof precinctSchema>;

const emptyManagement: TerritoryManagement = {
  cantons: [],
  precincts: [],
  stations: [],
  observers: [],
};

export function TerritoryManagementScreen({ navigation }: Props) {
  const session = useAppSelector((state) => state.auth.session);
  const [management, setManagement] =
    useState<TerritoryManagement>(emptyManagement);
  const [selectedObservers, setSelectedObservers] = useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCantonId, setSelectedCantonId] = useState("");
  const [isCreatingPrecinct, setIsCreatingPrecinct] = useState(false);
  const [observerSearch, setObserverSearch] = useState("");
  const { control, handleSubmit, reset } = useForm<PrecinctValues>({
    resolver: zodResolver(precinctSchema),
    defaultValues: { parish: "", name: "" },
  });

  const loadManagement = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const result = await territoryRepository.loadManagement(
        session.profile.role,
        session.userId,
        session.profile.province_id,
      );
      setManagement(result);
      setSelectedObservers({});
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la información territorial.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void Promise.resolve().then(loadManagement);
  }, [loadManagement]);

  if (!session || session.profile.role === "observer") {
    return (
      <AuthPage>
        <PageTitle
          title="Acceso no autorizado"
          description="Tu perfil no puede administrar territorio ni asignaciones."
        />
        <SecondaryButton label="Volver" onPress={() => navigation.goBack()} />
      </AuthPage>
    );
  }

  const isProvincial = session.profile.role === "provincial_coordinator";

  const assignObserver = async (
    stationId: string,
    currentObserver: TerritoryPerson | null,
  ) => {
    const observerId = Object.prototype.hasOwnProperty.call(
      selectedObservers,
      stationId,
    )
      ? selectedObservers[stationId]
      : currentObserver?.id ?? "";
    setBusyId(stationId);
    setError(null);
    setSuccess(null);
    try {
      await territoryRepository.assignObserver(
        stationId,
        observerId.length ? observerId : null,
      );
      setSuccess(
        observerId
          ? "Se guardó el veedor asignado a la mesa."
          : "La mesa quedó sin veedor asignado.",
      );
      await loadManagement();
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "No se pudo guardar la asignación.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const createPrecinct = handleSubmit(async (values) => {
    if (!selectedCantonId) {
      setError("Selecciona el cantón del nuevo recinto.");
      return;
    }

    setIsCreatingPrecinct(true);
    setError(null);
    setSuccess(null);
    try {
      await territoryRepository.createPrecinct({
        cantonId: selectedCantonId,
        parish: values.parish,
        name: values.name,
      });
      reset();
      setSelectedCantonId("");
      setSuccess("El recinto se agregó a tu jurisdicción.");
      await loadManagement();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo agregar el recinto.",
      );
    } finally {
      setIsCreatingPrecinct(false);
    }
  });
  const filteredObservers = management.observers.filter((person) =>
    `${person.fullName} ${person.email}`
      .toLocaleLowerCase()
      .includes(observerSearch.trim().toLocaleLowerCase()),
  );

  return (
    <AuthPage>
      <PageTitle
        title={
          isProvincial
            ? "Territorio y coordinadores"
            : "Mesas y veedores"
        }
        description={
          isProvincial
            ? "Consulta los recintos de tu jurisdicción. El coordinador de cada recinto se define al crear su cuenta; desde aquí no se reasigna."
            : "Administra los veedores de tus mesas. Un veedor puede cubrir varias mesas."
        }
      />
      {error ? <Feedback message={error} /> : null}
      {success ? <Feedback kind="success" message={success} /> : null}
      {isLoading ? (
        <Feedback kind="info" message="Cargando datos autorizados…" />
      ) : isProvincial ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>Agregar recinto</Text>
            <Text style={styles.detail}>
              Selecciona un cantón de tu provincia. No se crean mesas ni datos
              territoriales fuera de tu jurisdicción.
            </Text>
            {management.cantons.length ? (
              management.cantons.map((canton) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selectedCantonId === canton.id,
                  }}
                  key={canton.id}
                  onPress={() => setSelectedCantonId(canton.id)}
                  style={[
                    styles.option,
                    selectedCantonId === canton.id
                      ? styles.optionSelected
                      : null,
                  ]}
                >
                  <Text style={styles.optionName}>{canton.name}</Text>
                </Pressable>
              ))
            ) : (
              <Feedback
                kind="info"
                message="No hay cantones cargados en tu jurisdicción."
              />
            )}
            <FormField
              autoCapitalize="words"
              control={control}
              label="Parroquia"
              name="parish"
              placeholder="Nombre de la parroquia"
            />
            <FormField
              autoCapitalize="words"
              control={control}
              label="Recinto"
              name="name"
              placeholder="Nombre del recinto"
            />
            <PrimaryButton
              disabled={
                isCreatingPrecinct ||
                isLoading ||
                management.cantons.length === 0
              }
              label={
                isCreatingPrecinct ? "Guardando…" : "Agregar recinto"
              }
              onPress={() => void createPrecinct()}
            />
          </View>
          {management.precincts.length ? (
            <>
              <Feedback
                kind="info"
                message="El coordinador de recinto se asigna al crear su cuenta. Un recinto con coordinador no puede tomar otro y esta pantalla no permite reasignarlo. Si necesitas otro coordinador, crea su cuenta seleccionando un recinto que esté libre."
              />
              {management.precincts.map((precinct) => (
                <View key={precinct.id} style={styles.card}>
                  <Text style={styles.title}>{precinct.name}</Text>
                  <Text style={styles.detail}>
                    {precinct.parish} · {precinct.cantonName}
                  </Text>
                  <Text style={styles.label}>
                    {precinct.coordinator
                      ? `Coordinador asignado: ${precinct.coordinator.fullName}`
                      : "Sin coordinador asignado. Crea la cuenta del coordinador y selecciona este recinto al registrarlo."}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <Feedback
              kind="info"
              message="No hay recintos precargados en tu jurisdicción."
            />
          )}
        </>
      ) : management.stations.length ? (
        <>
          <Text style={styles.label}>Buscar veedor</Text>
          <TextInput
            accessibilityLabel="Buscar veedor"
            autoCapitalize="none"
            onChangeText={setObserverSearch}
            placeholder="Nombre o correo"
            style={styles.search}
            value={observerSearch}
          />
          {management.stations.map((station) => {
          const selectedId = Object.prototype.hasOwnProperty.call(
            selectedObservers,
            station.id,
          )
            ? selectedObservers[station.id]
            : station.observer?.id ?? "";
          return (
            <View key={station.id} style={styles.card}>
              <Text style={styles.title}>
                Mesa {station.stationNumber} · {station.precinctName}
              </Text>
              <Text style={styles.label}>
                {station.observer
                  ? `Veedor actual: ${station.observer.fullName}`
                  : "Mesa sin veedor asignado."}
              </Text>
              <PersonOption
                person={{ id: "", fullName: "Sin asignar", email: "" }}
                selected={!selectedId}
                onPress={() =>
                  setSelectedObservers((current) => ({
                    ...current,
                    [station.id]: "",
                  }))
                }
              />
              {observerSearch.trim()
                ? filteredObservers.map((observer) => (
                    <PersonOption
                      key={observer.id}
                      person={observer}
                      selected={selectedId === observer.id}
                      onPress={() =>
                        setSelectedObservers((current) => ({
                          ...current,
                          [station.id]: observer.id,
                        }))
                      }
                    />
                  ))
                : (
                    <Feedback
                      kind="info"
                      message="Busca por nombre o correo para seleccionar un veedor."
                    />
                  )}
              {management.observers.length === 0 ? (
                <Feedback
                  kind="info"
                  message="No hay veedores disponibles. Crea la cuenta del equipo antes de asignarla."
                />
              ) : null}
              <PrimaryButton
                disabled={
                  busyId === station.id ||
                  (!selectedId && !station.observer) ||
                  selectedId === station.observer?.id
                }
                label={
                  busyId === station.id
                    ? "Guardando…"
                    : station.observer && !selectedId
                      ? "Quitar asignación"
                      : station.observer
                      ? "Reemplazar veedor"
                      : "Asignar veedor"
                }
                onPress={() =>
                  void assignObserver(station.id, station.observer)
                }
              />
            </View>
          );
          })}
        </>
      ) : (
        <Feedback
          kind="info"
          message="No hay mesas precargadas en tu recinto."
        />
      )}
      <SecondaryButton
        label="Crear cuenta de equipo"
        onPress={() => navigation.navigate("ManageAccounts")}
      />
      <SecondaryButton label="Volver" onPress={() => navigation.goBack()} />
    </AuthPage>
  );
}

function PersonOption({
  person,
  selected,
  onPress,
}: {
  person: TerritoryPerson;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, selected ? styles.optionSelected : null]}
    >
      <Text style={styles.optionName}>{person.fullName}</Text>
      {person.email ? <Text style={styles.detail}>{person.email}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
    padding: 14,
  },
  title: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  detail: {
    color: "#4B5563",
    fontSize: 13,
  },
  search: {
    borderColor: "#9CA3AF",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    marginBottom: 12,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  option: {
    borderColor: "#9CA3AF",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  optionSelected: {
    borderColor: "#111827",
    borderWidth: 2,
  },
  optionName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
});
