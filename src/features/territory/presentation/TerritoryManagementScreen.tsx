import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight, UserPlus } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { useAppSelector } from "../../../app/store";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
import { territoryRepository } from "../data";
import type {
  TerritoryManagement,
  TerritoryPerson,
} from "../domain/territory";
import {
  ActionCard,
  AuthPage,
  EmptyState,
  Feedback,
  FormField,
  LoadingBlock,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SegmentedTabs,
  StatusChip,
} from "../../access/presentation/components/AuthUi";

type TerritoryStation = TerritoryManagement["stations"][number];

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
  const [selectedObserverId, setSelectedObserverId] = useState("");
  const [activeStation, setActiveStation] = useState<TerritoryStation | null>(
    null,
  );
  const [provincialTab, setProvincialTab] = useState<"precincts" | "create">(
    "precincts",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCantonId, setSelectedCantonId] = useState("");
  const [isCreatingPrecinct, setIsCreatingPrecinct] = useState(false);
  const [observerSearch, setObserverSearch] = useState("");
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
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
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la información territorial.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    void Promise.resolve().then(loadManagement);
  }, [loadManagement]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.72}
        pressBehavior="close"
      />
    ),
    [],
  );

  if (!session || session.profile.role === "observer") {
    return (
      <AuthPage>
        <PageTitle
          eyebrow="Acceso"
          title="No tienes permiso para esta tarea"
          description="Solo coordinadores pueden administrar territorio y asignaciones."
        />
        <SecondaryButton
          label="Volver al inicio"
          onPress={() => navigation.goBack()}
        />
      </AuthPage>
    );
  }

  const isProvincial = session.profile.role === "provincial_coordinator";

  const assignObserver = async (station: TerritoryStation) => {
    setBusyId(station.id);
    setError(null);
    setSuccess(null);
    try {
      await territoryRepository.assignObserver(
        station.id,
        selectedObserverId.length ? selectedObserverId : null,
      );
      setSuccess(
        selectedObserverId
          ? "Se guardó el veedor asignado a la mesa."
          : "La mesa quedó sin veedor asignado.",
      );
      sheetRef.current?.close();
      setActiveStation(null);
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
      setProvincialTab("precincts");
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
    <AuthPage
      onBack={() => navigation.goBack()}
      onRefresh={() => {
        setIsRefreshing(true);
        void loadManagement();
      }}
      overlay={
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={["72%"]}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
          onClose={() => setActiveStation(null)}
        >
          <BottomSheetScrollView
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: spacing.xxxl + insets.bottom },
            ]}
          >
            {activeStation ? (
              <>
                <Text style={styles.sheetEyebrow}>Asignar veedor</Text>
                <Text style={styles.sheetTitle}>
                  Mesa {activeStation.stationNumber}
                  {activeStation.sex
                    ? ` · ${activeStation.sex === "female" ? "Mujeres" : "Hombres"}`
                    : ""}
                </Text>
                <Text style={styles.detail}>{activeStation.precinctName}</Text>

                <TextInput
                  accessibilityLabel="Buscar veedor"
                  autoCapitalize="none"
                  onChangeText={setObserverSearch}
                  placeholder="Buscar por nombre o correo"
                  placeholderTextColor={colors.inkMuted}
                  selectionColor={colors.primary}
                  style={styles.search}
                  value={observerSearch}
                />

                <View style={styles.options}>
                  <PersonOption
                    person={{ id: "", fullName: "Sin asignar", email: "" }}
                    selected={!selectedObserverId}
                    onPress={() => setSelectedObserverId("")}
                  />
                  {filteredObservers.map((observer) => (
                    <PersonOption
                      key={observer.id}
                      person={observer}
                      selected={selectedObserverId === observer.id}
                      onPress={() => setSelectedObserverId(observer.id)}
                    />
                  ))}
                </View>

                {management.observers.length === 0 ? (
                  <Feedback
                    kind="info"
                    message="No hay veedores disponibles. Crea la cuenta del equipo antes de asignarla."
                  />
                ) : null}

                <PrimaryButton
                  disabled={
                    busyId === activeStation.id ||
                    (!selectedObserverId && !activeStation.observer) ||
                    selectedObserverId === activeStation.observer?.id
                  }
                  label={
                    busyId === activeStation.id
                      ? "Guardando…"
                      : activeStation.observer && !selectedObserverId
                        ? "Quitar asignación"
                        : activeStation.observer
                          ? "Reemplazar veedor"
                          : "Asignar veedor"
                  }
                  onPress={() => void assignObserver(activeStation)}
                />
              </>
            ) : null}
          </BottomSheetScrollView>
        </BottomSheet>
      }
      refreshing={isRefreshing}
    >
      <PageTitle
        eyebrow="Territorio"
        title={
          isProvincial ? "Territorio y coordinadores" : "Mesas y veedores"
        }
        description={
          isProvincial
            ? "Recintos de tu jurisdicción."
            : "Toca una mesa para asignar veedor."
        }
      />
      <ActionCard
        icon={UserPlus}
        title={isProvincial ? "Registrar coordinador" : "Registrar veedor"}
        description={
          isProvincial
            ? "Crear cuenta y elegir recinto"
            : "Crear acceso; asigna mesas después"
        }
        onPress={() => navigation.navigate("ManageAccounts")}
      />
      {error ? <Feedback message={error} /> : null}
      {success ? <Feedback kind="success" message={success} /> : null}
      {isLoading ? (
        <LoadingBlock message="Cargando tu territorio…" />
      ) : isProvincial ? (
        <>
          <SegmentedTabs
            onChange={setProvincialTab}
            options={[
              {
                key: "precincts",
                label: "Recintos",
                badge: management.precincts.length,
              },
              { key: "create", label: "Nuevo recinto" },
            ]}
            value={provincialTab}
          />

          {provincialTab === "create" ? (
            <View style={styles.formSection}>
              <Text style={styles.detail}>
                Elige un cantón de tu provincia. Solo se crea dentro de tu
                jurisdicción.
              </Text>
              <View style={styles.options}>
                {management.cantons.length ? (
                  management.cantons.map((canton) => {
                    const isSelected = selectedCantonId === canton.id;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        key={canton.id}
                        onPress={() => setSelectedCantonId(canton.id)}
                        style={[
                          styles.option,
                          isSelected ? styles.optionSelected : null,
                        ]}
                      >
                        <View
                          style={[
                            styles.optionDot,
                            isSelected ? styles.optionDotSelected : null,
                          ]}
                        >
                          {isSelected ? <View style={styles.optionDotFill} /> : null}
                        </View>
                        <Text
                          style={[
                            styles.optionName,
                            isSelected ? styles.optionNameSelected : null,
                          ]}
                        >
                          {canton.name}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <EmptyState
                    title="Sin cantones disponibles"
                    message="Tu jurisdicción todavía no tiene cantones cargados."
                  />
                )}
              </View>
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
                label={isCreatingPrecinct ? "Guardando…" : "Agregar recinto"}
                onPress={() => void createPrecinct()}
              />
            </View>
          ) : management.precincts.length ? (
            <View style={styles.flatList}>
              {management.precincts.map((precinct) => (
                <View key={precinct.id} style={styles.flatRow}>
                  <View style={styles.flatRowCopy}>
                    <Text style={styles.rowTitle}>{precinct.name}</Text>
                    <Text style={styles.detail}>
                      {precinct.parish} · {precinct.cantonName}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {precinct.coordinator
                        ? `Coordinador: ${precinct.coordinator.fullName}`
                        : "Sin coordinador asignado"}
                    </Text>
                  </View>
                  <StatusChip
                    label={precinct.coordinator ? "Con coord." : "Libre"}
                    tone={precinct.coordinator ? "success" : "warning"}
                  />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              title="No hay recintos todavía"
              message="Agrega el primer recinto de tu provincia en la pestaña Nuevo recinto."
            />
          )}
        </>
      ) : management.stations.length ? (
        <View style={styles.flatList}>
          {management.stations.map((station) => (
            <Pressable
              accessibilityLabel={`Asignar veedor a mesa ${station.stationNumber}`}
              accessibilityRole="button"
              key={station.id}
              onPress={() => {
                setActiveStation(station);
                setSelectedObserverId(station.observer?.id ?? "");
                setObserverSearch("");
                sheetRef.current?.expand();
              }}
              style={styles.flatRow}
            >
              <View style={styles.flatRowCopy}>
                <Text style={styles.rowTitle}>
                  Mesa {station.stationNumber}
                  {station.sex
                    ? ` · ${station.sex === "female" ? "Mujeres" : "Hombres"}`
                    : ""}
                </Text>
                <Text style={styles.detail}>{station.precinctName}</Text>
                <Text style={styles.rowMeta}>
                  {station.observer
                    ? `Veedor: ${station.observer.fullName}`
                    : "Toca para asignar veedor"}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <StatusChip
                  label={station.observer ? "Asignada" : "Libre"}
                  tone={station.observer ? "success" : "warning"}
                />
                <ChevronRight color={colors.inkMuted} size={18} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No hay mesas todavía"
          message="Las mesas aparecerán cuando estén cargadas en tu recinto."
        />
      )}
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
      <View
        style={[
          styles.optionDot,
          selected ? styles.optionDotSelected : null,
        ]}
      >
        {selected ? <View style={styles.optionDotFill} /> : null}
      </View>
      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionName,
            selected ? styles.optionNameSelected : null,
          ]}
        >
          {person.fullName}
        </Text>
        {person.email ? (
          <Text style={styles.optionEmail}>{person.email}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  formSection: {
    gap: spacing.sm,
  },
  flatList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  flatRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  flatRowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 21,
  },
  rowMeta: {
    color: colors.primary,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  rowRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  detail: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  search: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  sheetBackground: {
    backgroundColor: colors.surface,
  },
  sheetHandle: {
    backgroundColor: colors.inkMuted,
  },
  sheetContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetEyebrow: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  sheetTitle: {
    color: colors.primaryDark,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
  },
  optionDot: {
    alignItems: "center",
    borderColor: colors.boneMuted,
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  optionDotSelected: {
    borderColor: colors.red,
  },
  optionDotFill: {
    backgroundColor: colors.red,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  optionCopy: {
    flex: 1,
    gap: 1,
  },
  optionName: {
    color: colors.bone,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  optionNameSelected: {
    color: colors.white,
  },
  optionEmail: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
});
