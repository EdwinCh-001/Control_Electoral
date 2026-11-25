import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Info,
  Inbox,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";

import {
  colors,
  fonts,
  radii,
  spacing,
  surface,
  typography,
} from "../theme";
import { humanizeErrorMessage, type NoticeKind } from "../messages";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScreenProps {
  children: React.ReactNode;
  overlay?: React.ReactNode;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function Screen({
  children,
  overlay,
  onBack,
  headerRight,
  onRefresh,
  refreshing = false,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                colors={[colors.primary]}
                onRefresh={onRefresh}
                refreshing={refreshing}
                tintColor={colors.primary}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        >
          <AppMasthead headerRight={headerRight} onBack={onBack} />
          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
      {overlay}
    </SafeAreaView>
  );
}

function AppMasthead({
  onBack,
  headerRight,
}: {
  onBack?: () => void;
  headerRight?: React.ReactNode;
}) {
  return (
    <View style={styles.masthead}>
      {onBack ? (
        <PressableScale
          accessibilityLabel="Volver"
          onPress={onBack}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.primaryDark} size={20} strokeWidth={2.3} />
        </PressableScale>
      ) : (
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>7</Text>
        </View>
      )}
      <Text style={styles.brandName}>Control Electoral</Text>
      {headerRight}
    </View>
  );
}

interface PageTitleProps {
  title: string;
  description?: string;
  eyebrow?: string;
}

export function PageTitle({ title, description, eyebrow }: PageTitleProps) {
  return (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.heading}>
      {eyebrow ? (
        <Text style={styles.eyebrowText}>{eyebrow}</Text>
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </Animated.View>
  );
}

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  secureTextToggle?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  hint?: string;
  numeric?: boolean;
  icon?: LucideIcon;
}

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  keyboardType,
  secureTextEntry,
  secureTextToggle = false,
  autoCapitalize,
  autoComplete,
  textContentType,
  hint,
  numeric = false,
  icon: Icon,
}: FormFieldProps<T>) {
  const { field, fieldState } = useController({ control, name });
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(Boolean(secureTextEntry));
  const showPasswordToggle = Boolean(secureTextEntry && secureTextToggle);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          isFocused ? styles.inputFocused : null,
          fieldState.error ? styles.inputError : null,
        ]}
      >
        {Icon ? (
          <Icon color={colors.primary} size={19} strokeWidth={2} />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          onBlur={() => {
            setIsFocused(false);
            field.onBlur();
          }}
          onChangeText={field.onChange}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          secureTextEntry={isSecure}
          selectionColor={colors.primary}
          style={[
            styles.input,
            numeric ? styles.inputNumeric : null,
          ]}
          textContentType={textContentType}
          value={typeof field.value === "string" ? field.value : ""}
        />
        {showPasswordToggle ? (
          <Pressable
            accessibilityLabel={isSecure ? "Mostrar contraseña" : "Ocultar contraseña"}
            accessibilityRole="button"
            accessibilityState={{ expanded: !isSecure }}
            onPress={() => setIsSecure((current) => !current)}
            style={styles.passwordToggle}
          >
            {isSecure ? (
              <Eye color={colors.primary} size={20} strokeWidth={2} />
            ) : (
              <EyeOff color={colors.primary} size={20} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>
      {fieldState.error?.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {fieldState.error.message}
        </Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface PressableScaleProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: PressableProps["accessibilityRole"];
  accessibilityState?: PressableProps["accessibilityState"];
  disabled?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

function PressableScale({
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
  accessibilityState,
  disabled = false,
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) {
          scale.set(withSpring(0.975, { damping: 18, stiffness: 260 }));
          onPressIn?.();
        }
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 18, stiffness: 260 }));
        onPressOut?.();
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  style,
}: ButtonProps) {
  return (
    <PressableScale
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null, style]}
    >
      <Text style={styles.buttonText}>{label}</Text>
      <ChevronRight
        color={colors.onPrimary}
        size={20}
        strokeWidth={2.4}
      />
    </PressableScale>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  style,
}: ButtonProps) {
  return (
    <PressableScale
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.secondaryButton,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </PressableScale>
  );
}

interface FeedbackProps {
  message: string;
  kind?: NoticeKind;
  title?: string;
  technicalDetails?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}

const noticePalette: Record<
  NoticeKind,
  { accent: string; icon: LucideIcon }
> = {
  info: { accent: colors.primarySoft, icon: Info },
  success: { accent: colors.primary, icon: CircleCheck },
  warning: { accent: colors.accentDeep, icon: TriangleAlert },
  error: { accent: colors.primaryDark, icon: CircleAlert },
};

const defaultNoticeTitles: Record<NoticeKind, string | undefined> = {
  info: undefined,
  success: "Listo",
  warning: "Revisa esto",
  error: "Revisa este punto",
};

export function Feedback({
  message,
  kind = "error",
  title,
  technicalDetails,
  actionLabel,
  onAction,
}: FeedbackProps) {
  const humanized = kind === "error" ? humanizeErrorMessage(message) : undefined;
  const resolvedTitle = title ?? humanized?.title ?? defaultNoticeTitles[kind];
  const resolvedMessage = humanized?.message ?? message;
  const resolvedTechnical = technicalDetails ?? humanized?.technicalDetails;
  const showTechnical =
    Boolean(resolvedTechnical) && resolvedTechnical !== resolvedMessage;
  const palette = noticePalette[kind];
  const NoticeIcon = palette.icon;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole={kind === "error" ? "alert" : undefined}
      entering={FadeInDown.duration(180)}
      style={[
        styles.notice,
        {
          borderColor: palette.accent,
          borderLeftColor: palette.accent,
        },
      ]}
    >
      <View style={[styles.noticeMark, { backgroundColor: palette.accent }]}>
        <NoticeIcon color={colors.onPrimary} size={17} strokeWidth={2.4} />
      </View>
      <View style={styles.noticeBody}>
        {resolvedTitle ? (
          <Text style={styles.noticeTitle}>{resolvedTitle}</Text>
        ) : null}
        <Text style={styles.noticeMessage}>{resolvedMessage}</Text>
        {showTechnical ? (
          <TechnicalDetails text={resolvedTechnical as string} />
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={styles.noticeAction}
          >
            <Text style={styles.noticeActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function TechnicalDetails({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.technical}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
      >
        <Text style={styles.technicalToggle}>
          {isOpen ? "Ocultar detalle técnico" : "Ver detalle técnico"}
        </Text>
      </Pressable>
      {isOpen ? (
        <Text selectable style={styles.technicalText}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

export type StatusTone =
  | "neutral"
  | "action"
  | "warning"
  | "success"
  | "danger"
  | "muted";

const statusPalette: Record<
  StatusTone,
  { border: string; background: string; dot: string; text: string }
> = {
  neutral: {
    border: colors.border,
    background: colors.background,
    dot: colors.ink,
    text: colors.ink,
  },
  action: {
    border: colors.primary,
    background: colors.primarySoftBg,
    dot: colors.primary,
    text: colors.primary,
  },
  warning: {
    border: colors.accentDeep,
    background: colors.accentSoft,
    dot: colors.accentDeep,
    text: colors.accentDeep,
  },
  success: {
    border: colors.primary,
    background: colors.primarySoftBg,
    dot: colors.primary,
    text: colors.primaryDark,
  },
  danger: {
    border: colors.primaryDark,
    background: colors.primarySoftBg,
    dot: colors.primaryDark,
    text: colors.primaryDark,
  },
  muted: {
    border: colors.border,
    background: "transparent",
    dot: colors.inkMuted,
    text: colors.inkMuted,
  },
};

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  const palette = statusPalette[tone];
  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.chip,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.chipText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

interface CardProps {
  children: React.ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, accent, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        accent
          ? { borderLeftColor: accent, borderLeftWidth: 3 }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {children}
      </Text>
      {aside}
    </View>
  );
}

export function Metric({
  value,
  label,
  tone = "default",
}: {
  value: string | number;
  label: string;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const color =
    tone === "warning"
      ? colors.accentDeep
      : tone === "success"
        ? colors.primary
        : tone === "danger"
          ? colors.primaryDark
          : colors.ink;
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  value,
  tone = "success",
}: {
  value: number;
  tone?: "warning" | "success" | "danger";
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const color =
    tone === "warning"
      ? colors.accentDeep
      : tone === "danger"
        ? colors.primaryDark
        : colors.primary;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: safeValue }}
      style={styles.progressTrack}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: color, width: `${safeValue}%` },
        ]}
      />
    </View>
  );
}

export function VoteValue({
  value,
  size = "md",
}: {
  value: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (value === null) {
    return (
      <View
        accessibilityLabel="Sin dato, requiere revisión"
        style={[styles.voteReview, size === "sm" ? styles.voteReviewSm : null]}
      >
        <TriangleAlert
          color={colors.accentDeep}
          size={13}
          strokeWidth={2.4}
        />
        <Text style={styles.voteReviewText}>Revisión</Text>
      </View>
    );
  }

  return (
    <Text
      accessibilityLabel={value === 0 ? "Cero confirmado" : `${value} votos`}
      style={[
        styles.voteNumber,
        size === "sm"
          ? styles.voteNumberSm
          : size === "lg"
            ? styles.voteNumberLg
            : null,
        { color: value === 0 ? colors.primaryDark : colors.ink },
      ]}
    >
      {value}
    </Text>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
  badge?: string;
  icon?: LucideIcon;
}

export function ActionCard({
  title,
  description,
  onPress,
  tone = "secondary",
  badge,
  icon: Icon,
}: ActionCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const isActive = tone === "primary" || isPressed;
  return (
    <PressableScale
      accessibilityHint={description}
      accessibilityLabel={title}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={[
        styles.actionCard,
        isActive ? styles.actionCardPrimary : styles.actionCardSecondary,
      ]}
    >
      {Icon ? (
        <View
          style={[
            styles.actionIcon,
            isActive ? styles.actionIconPrimary : null,
          ]}
        >
          <Icon
            color={isActive ? colors.accent : colors.primary}
            size={22}
            strokeWidth={2.2}
          />
        </View>
      ) : null}
      <View style={styles.actionCopy}>
        {badge ? (
          <Text
            style={[
              styles.actionBadge,
              isActive ? styles.actionBadgePrimary : null,
            ]}
          >
            {badge}
          </Text>
        ) : null}
        <Text
          style={[
            styles.actionTitle,
            isActive ? styles.actionTitlePrimary : null,
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.actionDescription,
            isActive ? styles.actionDescriptionPrimary : null,
          ]}
        >
          {description}
        </Text>
      </View>
      <ChevronRight
        color={isActive ? colors.accent : colors.primary}
        size={24}
        strokeWidth={2.2}
      />
    </PressableScale>
  );
}

export interface SegmentedTabOption<T extends string> {
  key: T;
  label: string;
  badge?: string | number;
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.segmentedTrack}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.segmentedTab,
              active ? styles.segmentedTabActive : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentedText,
                active ? styles.segmentedTextActive : null,
              ]}
            >
              {option.label}
            </Text>
            {option.badge !== undefined ? (
              <View
                style={[
                  styles.segmentedBadge,
                  active ? styles.segmentedBadgeActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.segmentedBadgeText,
                    active ? styles.segmentedBadgeTextActive : null,
                  ]}
                >
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActionTile({
  title,
  subtitle,
  onPress,
  tone = "secondary",
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
  icon: LucideIcon;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const isActive = tone === "primary" || isPressed;
  return (
    <PressableScale
      accessibilityHint={subtitle}
      accessibilityLabel={title}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={[
        styles.actionTile,
        isActive ? styles.actionTilePrimary : styles.actionTileSecondary,
      ]}
    >
      <View style={styles.actionTileTop}>
        <View
          style={[
            styles.actionIcon,
            isActive ? styles.actionIconPrimary : null,
          ]}
        >
          <Icon
            color={isActive ? colors.accent : colors.primary}
            size={21}
            strokeWidth={2.2}
          />
        </View>
        <ChevronRight
          color={isActive ? colors.accent : colors.primarySoft}
          size={18}
          strokeWidth={2.2}
        />
      </View>
      <View style={styles.actionTileCopy}>
        <Text
          style={[
            styles.actionTileTitle,
            isActive ? styles.actionTitlePrimary : null,
          ]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.actionTileSubtitle,
            isActive ? styles.actionDescriptionPrimary : null,
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}>
        <Inbox color={colors.primary} size={20} strokeWidth={2} />
      </View>
      <View style={styles.emptyCopy}>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          {title}
        </Text>
        <Text style={styles.emptyMessage}>{message}</Text>
      </View>
    </View>
  );
}

export function LoadingBlock({ message }: { message: string }) {
  return (
    <View style={styles.loadingBlock}>
      <ActivityIndicator color={colors.red} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export type WorkflowState = "done" | "current" | "todo" | "error";

export function WorkflowStrip({
  steps,
}: {
  steps: { label: string; state: WorkflowState }[];
}) {
  return (
    <View style={styles.workflow}>
      {steps.map((step, index) => {
        const isDone = step.state === "done";
        const isCurrent = step.state === "current";
        const isError = step.state === "error";
        return (
          <View key={step.label} style={styles.workflowItem}>
            <View style={styles.workflowTop}>
              <View
                style={[
                  styles.workflowDot,
                  isDone ? styles.workflowDotDone : null,
                  isCurrent ? styles.workflowDotCurrent : null,
                  isError ? styles.workflowDotError : null,
                ]}
              >
                {isDone ? (
                  <Check color={colors.onPrimary} size={13} strokeWidth={3} />
                ) : isError ? (
                  <CircleAlert
                    color={colors.onPrimary}
                    size={13}
                    strokeWidth={2.6}
                  />
                ) : (
                  <View style={styles.workflowDotInner} />
                )}
              </View>
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.workflowLine,
                    isDone ? styles.workflowLineDone : null,
                    isError ? styles.workflowLineError : null,
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.workflowLabel,
                isCurrent ? styles.workflowLabelCurrent : null,
                isError ? styles.workflowLabelError : null,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

interface ConfirmActionSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "primary" | "danger" | "warning";
  children?: React.ReactNode;
}

export function ConfirmActionSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  tone = "primary",
  children,
}: ConfirmActionSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const intentRef = useRef<"confirm" | "cancel" | null>(null);
  const insets = useSafeAreaInsets();
  const hasChildren = Boolean(children);
  const snapPoints = useMemo(
    () => (hasChildren ? ["72%"] : ["48%"]),
    [hasChildren],
  );
  const accent =
    tone === "warning"
      ? colors.accentDeep
      : tone === "danger"
        ? colors.primaryDark
        : colors.primary;

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

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

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      onClose={() => {
        const intent = intentRef.current;
        intentRef.current = null;
        if (!intent && visible) {
          onCancel();
        }
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.sheetContent,
          { paddingBottom: spacing.xxxl + insets.bottom },
        ]}
      >
        <View style={[styles.sheetAccent, { backgroundColor: accent }]} />
        <Text style={styles.sheetTitle}>{title}</Text>
        <Text style={styles.sheetMessage}>{message}</Text>
        {children}
        <PrimaryButton
          label={confirmLabel}
          onPress={() => {
            intentRef.current = "confirm";
            sheetRef.current?.close();
            onConfirm();
          }}
        />
        <SecondaryButton
          label={cancelLabel}
          onPress={() => {
            intentRef.current = "cancel";
            sheetRef.current?.close();
            onCancel();
          }}
        />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  flex: {
    flex: 1,
  },
  topRule: {
    backgroundColor: colors.red,
    height: 3,
  },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: 620,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    width: "100%",
  },
  body: {
    flex: 1,
    gap: spacing.lg,
  },
  masthead: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderBottomColor: colors.accent,
    borderBottomWidth: 3,
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  brandMarkText: {
    color: colors.onPrimary,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  brandIdentity: {
    marginLeft: 10,
  },
  brandName: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  brandTagline: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  mastheadLine: {
    backgroundColor: colors.navyBorder,
    flex: 1,
    height: 1,
    marginLeft: 14,
  },
  heading: {
    marginBottom: spacing.sm,
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: spacing.sm,
  },
  eyebrowMark: {
    backgroundColor: colors.red,
    height: 2,
    width: 16,
  },
  eyebrowText: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  title: {
    ...typography.title,
  },
  description: {
    ...typography.subtitle,
    marginTop: spacing.sm,
  },
  titleRule: {
    backgroundColor: colors.red,
    height: 3,
    marginTop: spacing.lg,
    width: 36,
  },
  field: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  fieldLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    ...typography.label,
    color: colors.bone,
  },
  numericHint: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 54,
    paddingVertical: spacing.sm,
  },
  inputNumeric: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "right",
  },
  passwordToggle: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  inputFocused: {
    borderColor: colors.red,
  },
  inputError: {
    borderColor: colors.red,
  },
  fieldError: {
    color: colors.primaryDark,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  fieldHint: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.red,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    ...typography.button,
    flex: 1,
  },
  buttonArrow: {
    color: colors.onPrimary,
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 26,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  secondaryText: {
    color: colors.bone,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: colors.navyDeep,
    borderRadius: radii.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  noticeMark: {
    alignItems: "center",
    borderRadius: radii.sm,
    height: 28,
    justifyContent: "center",
    marginTop: 1,
    width: 28,
  },
  noticeMarkText: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 20,
  },
  noticeBody: {
    flex: 1,
    gap: 3,
  },
  noticeTitle: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  noticeMessage: {
    color: colors.bone,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  noticeAction: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 2,
  },
  noticeActionText: {
    color: colors.red,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  technical: {
    gap: 4,
    marginTop: spacing.xs,
  },
  technicalToggle: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  technicalText: {
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    color: colors.boneMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    padding: spacing.sm,
  },
  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipDot: {
    borderRadius: 3,
    height: 7,
    width: 7,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    ...surface,
    padding: spacing.lg,
  },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.section,
  },
  sectionLine: {
    backgroundColor: colors.navyBorder,
    flex: 1,
    height: 1,
  },
  metric: {
    gap: 2,
    minWidth: 0,
  },
  metricValue: {
    ...typography.numeric,
  },
  metricLabel: {
    ...typography.small,
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    backgroundColor: colors.navyBorder,
    borderRadius: radii.pill,
    height: 8,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    borderRadius: radii.pill,
    height: "100%",
  },
  voteReview: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  voteReviewSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  voteReviewDot: {
    backgroundColor: colors.amber,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  voteReviewText: {
    color: colors.accentDeep,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  voteNumber: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    lineHeight: 28,
  },
  voteNumberSm: {
    fontSize: 19,
    lineHeight: 23,
  },
  voteNumberLg: {
    fontSize: 30,
    lineHeight: 34,
  },
  actionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 92,
    padding: spacing.lg,
  },
  actionCardPrimary: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  actionCardSecondary: {
    backgroundColor: colors.navyDeep,
    borderColor: colors.navyBorder,
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoftBg,
    borderRadius: radii.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  actionIconPrimary: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  actionTile: {
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: spacing.lg,
    justifyContent: "space-between",
    minHeight: 162,
    minWidth: "46%",
    padding: spacing.lg,
  },
  actionTilePrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionTileSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionTileTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionTileCopy: {
    gap: 4,
  },
  actionTileTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 23,
  },
  actionTileSubtitle: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 19,
  },
  segmentedTrack: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  segmentedTab: {
    alignItems: "center",
    borderRadius: radii.sm,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  segmentedTabActive: {
    backgroundColor: colors.primary,
  },
  segmentedText: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  segmentedTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
  },
  segmentedBadge: {
    backgroundColor: colors.primarySoftBg,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  segmentedBadgeActive: {
    backgroundColor: colors.accent,
  },
  segmentedBadgeText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  segmentedBadgeTextActive: {
    color: colors.primaryDark,
  },
  actionCopy: {
    flex: 1,
    gap: 3,
  },
  actionBadge: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  actionBadgePrimary: {
    color: colors.bone,
  },
  actionTitle: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 23,
  },
  actionTitlePrimary: {
    color: colors.onPrimary,
  },
  actionDescription: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actionDescriptionPrimary: {
    color: colors.onPrimaryMuted,
  },
  actionArrow: {
    alignSelf: "center",
    color: colors.bone,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 30,
  },
  actionArrowPrimary: {
    color: colors.onPrimary,
  },
  empty: {
    alignItems: "center",
    borderColor: colors.navyBorder,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyMark: {
    alignItems: "center",
    backgroundColor: colors.primarySoftBg,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  emptyCopy: {
    flex: 1,
    gap: 3,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  emptyMessage: {
    ...typography.small,
  },
  loadingBlock: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    ...typography.small,
    textAlign: "center",
  },
  workflow: {
    flexDirection: "row",
  },
  workflowItem: {
    flex: 1,
    paddingRight: 3,
  },
  workflowTop: {
    alignItems: "center",
    flexDirection: "row",
  },
  workflowDot: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: colors.navyBorder,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  workflowDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  workflowDotCurrent: {
    backgroundColor: colors.accentDeep,
    borderColor: colors.accentDeep,
  },
  workflowDotError: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  workflowDotInner: {
    backgroundColor: colors.inkMuted,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  workflowDotText: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
  },
  workflowDotTextDone: {
    color: colors.onPrimary,
  },
  workflowLine: {
    backgroundColor: colors.navyBorder,
    flex: 1,
    height: 1,
    marginHorizontal: 4,
  },
  workflowLineDone: {
    backgroundColor: colors.primary,
  },
  workflowLineError: {
    backgroundColor: colors.primaryDark,
  },
  workflowLabel: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  workflowLabelCurrent: {
    color: colors.accentDeep,
    fontFamily: fonts.bodyBold,
  },
  workflowLabelError: {
    color: colors.primaryDark,
    fontFamily: fonts.bodyBold,
  },
  sheetBackground: {
    backgroundColor: colors.navyDeep,
  },
  sheetHandle: {
    backgroundColor: colors.boneMuted,
  },
  sheetContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetAccent: {
    borderRadius: 2,
    height: 4,
    marginBottom: spacing.xs,
    width: 42,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 28,
  },
  sheetMessage: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
});
