import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, Text, TextInput, View } from "react-native";
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
import { colors } from "../../../shared/presentation/theme";
import type { PollingStationSex } from "../../../shared/domain/pollingStation";
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

const stationSchema = z.object({
  stationNumber: z
    .string()
    .trim()
    .min(1, "Ingresa el número de mesa.")
    .regex(/^\d+$/, "Usa solo números.")
    .refine((value) => Number(value) > 0, "Debe ser mayor a cero."),
  sex: z.enum(["female", "male"], {
    error: "Selecciona el sexo de la mesa.",
  }).optional(),
});

type StationValues = z.infer<typeof stationSchema>;

const sexOptions: { value: PollingStationSex; label: string }[] = [
  { value: "female", label: "Mujeres" },
  { value: "male", label: "Hombres" },
];

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
  const [coordinatorTab, setCoordinatorTab] = useState<
    "stations" | "createStation"
  >("stations");
  const [selectedStationSex, setSelectedStationSex] = useState<
    PollingStationSex | ""
  >("");
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
  const {
    control: stationControl,
    handleSubmit: handleStationSubmit,
    reset: resetStation,
    setValue: setStationValue,
  } = useForm<StationValues>({
    resolver: zodResolver(stationSchema),
    defaultValues: { stationNumber: "", sex: undefined },
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
  const myPrecinct = management.precincts[0] ?? null;

  const createStation = handleStationSubmit(async (values) => {
    if (!myPrecinct) {
      setError("Tu cuenta todavía no tiene un recinto asignado.");
      return;
    }
    if (!values.sex) {
      setError("Selecciona el sexo de la mesa.");
      return;
    }

    setBusyId("create-station");
    setError(null);
    setSuccess(null);
    try {
      await territoryRepository.createStation({
        precinctId: myPrecinct.id,
        stationNumber: Number(values.stationNumber),
        sex: values.sex as PollingStationSex,
      });
      resetStation();
      setSelectedStationSex("");
      setSuccess("La mesa se agregó a tu recinto.");
      setCoordinatorTab("stations");
      await loadManagement();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo agregar la mesa.",
      );
    } finally {
      setBusyId(null);
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
          backgroundStyle={{ backgroundColor: colors.surface }}
          handleIndicatorStyle={{ backgroundColor: colors.inkMuted }}
          onClose={() => setActiveStation(null)}
        >
          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          >
            <View className={classes.sheetContent}>
            {activeStation ? (
              <>
                <Text className={classes.sheetEyebrow}>Asignar veedor</Text>
                <Text className={classes.sheetTitle}>
                  Mesa {activeStation.stationNumber}
                  {activeStation.sex
                    ? ` · ${activeStation.sex === "female" ? "Mujeres" : "Hombres"}`
                    : ""}
                </Text>
                <Text className={classes.detail}>{activeStation.precinctName}</Text>

                <TextInput
                  accessibilityLabel="Buscar veedor"
                  autoCapitalize="none"
                  onChangeText={setObserverSearch}
                  placeholder="Buscar por nombre o correo"
                  placeholderTextColor={colors.inkMuted}
                  selectionColor={colors.primary}
                  className={classes.search}
                  value={observerSearch}
                />

                <View className={classes.options}>
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
            </View>
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
            : "Crea tus mesas y toca una para asignar veedor."
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
            <View className={classes.formSection}>
              <Text className={classes.detail}>
                Elige un cantón de tu provincia. Solo se crea dentro de tu
                jurisdicción.
              </Text>
              <View className={classes.options}>
                {management.cantons.length ? (
                  management.cantons.map((canton) => {
                    const isSelected = selectedCantonId === canton.id;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        key={canton.id}
                        onPress={() => setSelectedCantonId(canton.id)}
                        className={
                          isSelected
                            ? `${classes.option} ${classes.optionSelected}`
                            : classes.option
                        }
                      >
                        <View
                          className={
                            isSelected
                              ? `${classes.optionDot} ${classes.optionDotSelected}`
                              : classes.optionDot
                          }
                        >
                          {isSelected ? <View className={classes.optionDotFill} /> : null}
                        </View>
                        <Text
                          className={
                            isSelected
                              ? `${classes.optionName} ${classes.optionNameSelected}`
                              : classes.optionName
                          }
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
            <View className={classes.flatList}>
              {management.precincts.map((precinct) => (
                <View key={precinct.id} className={classes.flatRow}>
                  <View className={classes.flatRowCopy}>
                    <Text className={classes.rowTitle}>{precinct.name}</Text>
                    <Text className={classes.detail}>
                      {precinct.parish} · {precinct.cantonName}
                    </Text>
                    <Text className={classes.rowMeta}>
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
      ) : !myPrecinct ? (
        <EmptyState
          title="Sin recinto asignado"
          message="El coordinador provincial debe asignarte un recinto antes de crear mesas."
        />
      ) : (
        <>
          <SegmentedTabs
            onChange={setCoordinatorTab}
            options={[
              {
                key: "stations",
                label: "Mesas",
                badge: management.stations.length,
              },
              { key: "createStation", label: "Nueva mesa" },
            ]}
            value={coordinatorTab}
          />

          {coordinatorTab === "createStation" ? (
            <View className={classes.formSection}>
              <Text className={classes.detail}>
                Recinto: {myPrecinct.name}. Solo tú puedes crear sus mesas.
              </Text>
              <FormField
                control={stationControl}
                keyboardType="numeric"
                label="Número de mesa"
                name="stationNumber"
                numeric
                placeholder="Ej. 12"
              />
              <View className={classes.sexField}>
                <Text className={classes.label}>Sexo de la mesa</Text>
                <View className={classes.sexOptions}>
                  {sexOptions.map((option) => {
                    const isSelected = selectedStationSex === option.value;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        key={option.value}
                        onPress={() => {
                          setSelectedStationSex(option.value);
                          setStationValue("sex", option.value, {
                            shouldValidate: true,
                          });
                        }}
                        className={
                          isSelected
                            ? `${classes.sexOption} ${classes.sexOptionSelected}`
                            : classes.sexOption
                        }
                      >
                        <Text
                          className={
                            isSelected
                              ? `${classes.sexOptionText} ${classes.sexOptionTextSelected}`
                              : classes.sexOptionText
                          }
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <PrimaryButton
                disabled={busyId === "create-station" || isLoading}
                label={
                  busyId === "create-station" ? "Guardando…" : "Agregar mesa"
                }
                onPress={() => void createStation()}
              />
            </View>
          ) : management.stations.length ? (
            <View className={classes.flatList}>
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
                  className={classes.flatRow}
                >
                  <View className={classes.flatRowCopy}>
                    <Text className={classes.rowTitle}>
                      Mesa {station.stationNumber}
                      {station.sex
                        ? ` · ${station.sex === "female" ? "Mujeres" : "Hombres"}`
                        : ""}
                    </Text>
                    <Text className={classes.detail}>{station.precinctName}</Text>
                    <Text className={classes.rowMeta}>
                      {station.observer
                        ? `Veedor: ${station.observer.fullName}`
                        : "Toca para asignar veedor"}
                    </Text>
                  </View>
                  <View className={classes.rowRight}>
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
              message="Agrega la primera mesa en la pestaña Nueva mesa y luego asigna los veedores."
            />
          )}
        </>
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
      className={
        selected
          ? `${classes.option} ${classes.optionSelected}`
          : classes.option
      }
    >
      <View
        className={
          selected
            ? `${classes.optionDot} ${classes.optionDotSelected}`
            : classes.optionDot
        }
      >
        {selected ? <View className={classes.optionDotFill} /> : null}
      </View>
      <View className={classes.optionCopy}>
        <Text
          className={
            selected
              ? `${classes.optionName} ${classes.optionNameSelected}`
              : classes.optionName
          }
        >
          {person.fullName}
        </Text>
        {person.email ? (
          <Text className={classes.optionEmail}>{person.email}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const classes = {
  formSection: "gap-2",
  flatList: "border-t border-border",
  flatRow:
    "flex-row items-center justify-between gap-2 border-b border-border py-3",
  flatRowCopy: "flex-1 gap-[2px]",
  rowTitle: "font-body-bold text-[16px] leading-[21px] text-ink",
  rowMeta: "mt-[2px] font-body-medium text-[13px] leading-[18px] text-primary",
  rowRight: "flex-row items-center gap-1",
  detail: "font-body text-[13px] leading-[18px] text-ink-muted",
  search:
    "min-h-[48px] rounded-md border border-border bg-background px-3 font-body text-[15px] text-ink",
  sheetContent: "gap-2 px-5 pt-3",
  sheetEyebrow:
    "font-body-medium text-[12px] tracking-[0.4px] text-ink-muted",
  sheetTitle:
    "font-display text-[22px] font-bold leading-[26px] text-primary-dark",
  options: "gap-2",
  option:
    "flex-row items-center gap-2 rounded-md border border-border bg-background p-3",
  optionSelected: "border-primary bg-primary-soft-bg",
  optionDot:
    "h-4 w-4 items-center justify-center rounded-lg border border-ink-muted",
  optionDotSelected: "border-primary",
  optionDotFill: "h-2 w-2 rounded-[4px] bg-primary",
  optionCopy: "flex-1 gap-[1px]",
  optionName: "font-body-medium text-[14px] leading-[19px] text-ink",
  optionNameSelected: "text-primary-dark",
  optionEmail: "font-body text-[12px] leading-4 text-ink-muted",
  label: "font-body-medium text-label text-primary-dark",
  fieldError: "font-body-medium text-[14px] leading-[19px] text-primary-dark",
  sexField: "gap-2",
  sexOptions: "flex-row gap-2",
  sexOption:
    "min-h-11 flex-1 flex-row items-center justify-center rounded-md border border-border bg-background px-3",
  sexOptionSelected: "border-primary bg-primary-soft-bg",
  sexOptionText: "font-body-medium text-[14px] text-ink",
  sexOptionTextSelected: "font-body-bold text-primary-dark",
} as const;