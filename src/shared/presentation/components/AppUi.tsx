import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { withUniwind } from "uniwind";
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

import { colors } from "../theme";
import { humanizeErrorMessage, type NoticeKind } from "../messages";
import { LottieIcon, type LottieIconName } from "./LottieIcon";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ScreenProps {
  children: React.ReactNode;
  footerBackground?: React.ReactNode;
  overlay?: React.ReactNode;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function Screen({
  children,
  footerBackground,
  overlay,
  onBack,
  headerRight,
  onRefresh,
  refreshing = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <StyledSafeAreaView className={classes.safeArea}>
      {footerBackground ? (
        <View
          pointerEvents="none"
          style={{
            bottom: -insets.bottom,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        >
          {footerBackground}
        </View>
      ) : null}
      <KeyboardAvoidingView
        className={classes.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName={classes.content}
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
          <View className={classes.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
      {overlay}
    </StyledSafeAreaView>
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
    <View className={classes.masthead}>
      {onBack ? (
        <PressableScale
          accessibilityLabel="Volver"
          onPress={onBack}
          className={classes.backButton}
        >
          <ArrowLeft color={colors.primaryDark} size={20} strokeWidth={2.3} />
        </PressableScale>
      ) : (
        <View className={classes.brandMark}>
          <Text className={classes.brandMarkText}>7</Text>
        </View>
      )}
      <Text className={classes.brandName}>Control Electoral</Text>
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
    <Animated.View entering={FadeInDown.duration(240)} className={classes.heading}>
      {eyebrow ? (
        <Text className={classes.eyebrowText}>{eyebrow}</Text>
      ) : null}
      <Text accessibilityRole="header" className={classes.title}>
        {title}
      </Text>
      {description ? <Text className={classes.description}>{description}</Text> : null}
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
    <View className={classes.field}>
      <Text className={classes.label}>{label}</Text>
      <View
        className={
          isFocused || fieldState.error
            ? `${classes.inputWrap} border-primary`
            : classes.inputWrap
        }
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
          className={
            numeric
              ? `${classes.input} ${classes.inputNumeric}`
              : classes.input
          }
          textContentType={textContentType}
          value={typeof field.value === "string" ? field.value : ""}
        />
        {showPasswordToggle ? (
          <Pressable
            accessibilityLabel={isSecure ? "Mostrar contraseña" : "Ocultar contraseña"}
            accessibilityRole="button"
            accessibilityState={{ expanded: !isSecure }}
            onPress={() => setIsSecure((current) => !current)}
            className={classes.passwordToggle}
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
        <Text accessibilityLiveRegion="polite" className={classes.fieldError}>
          {fieldState.error.message}
        </Text>
      ) : hint ? (
        <Text className={classes.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface PressableScaleProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: PressableProps["accessibilityRole"];
  accessibilityState?: PressableProps["accessibilityState"];
  className?: string;
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
  className,
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
      className={className}
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
      className={
        disabled
          ? `${classes.button} ${classes.buttonDisabled}`
          : classes.button
      }
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      <Text className={classes.buttonText}>{label}</Text>
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
      className={
        disabled
          ? `${classes.secondaryButton} ${classes.buttonDisabled}`
          : classes.secondaryButton
      }
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      <Text className={classes.secondaryText}>{label}</Text>
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
  { accent: string; icon: LucideIcon; lottie?: LottieIconName }
> = {
  info: { accent: colors.primarySoft, icon: Info },
  success: { accent: colors.primary, icon: CircleCheck, lottie: "success" },
  warning: { accent: colors.accentDeep, icon: TriangleAlert, lottie: "alert" },
  error: { accent: colors.primaryDark, icon: CircleAlert, lottie: "alert" },
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
      className={classes.notice}
      entering={FadeInDown.duration(180)}
      style={{
        borderColor: palette.accent,
        borderLeftColor: palette.accent,
      }}
    >
      <View
        className={classes.noticeMark}
        style={{ backgroundColor: palette.lottie ? colors.surface : palette.accent }}
      >
        {palette.lottie ? (
          <LottieIcon name={palette.lottie} size={28} />
        ) : (
          <NoticeIcon color={colors.onPrimary} size={17} strokeWidth={2.4} />
        )}
      </View>
      <View className={classes.noticeBody}>
        {resolvedTitle ? (
          <Text className={classes.noticeTitle}>{resolvedTitle}</Text>
        ) : null}
        <Text className={classes.noticeMessage}>{resolvedMessage}</Text>
        {showTechnical ? (
          <TechnicalDetails text={resolvedTechnical as string} />
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            className={classes.noticeAction}
          >
            <Text className={classes.noticeActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function TechnicalDetails({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View className={classes.technical}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((current) => !current)}
      >
        <Text className={classes.technicalToggle}>
          {isOpen ? "Ocultar detalle técnico" : "Ver detalle técnico"}
        </Text>
      </Pressable>
      {isOpen ? (
        <Text selectable className={classes.technicalText}>
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
      className={classes.chip}
      style={{ backgroundColor: palette.background, borderColor: palette.border }}
    >
      <Text className={classes.chipText} style={{ color: palette.text }}>
        {label}
      </Text>
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
      className={classes.card}
      style={[
        accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : null,
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
    <View className={classes.sectionRow}>
      <Text accessibilityRole="header" className={classes.sectionTitle}>
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
    <View className={classes.metric}>
      <Text className={classes.metricValue} style={{ color, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text className={classes.metricLabel}>{label}</Text>
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
      className={classes.progressTrack}
    >
      <View
        className={classes.progressFill}
        style={{ backgroundColor: color, width: `${safeValue}%` }}
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
        className={
          size === "sm"
            ? `${classes.voteReview} ${classes.voteReviewSm}`
            : classes.voteReview
        }
      >
        <TriangleAlert
          color={colors.accentDeep}
          size={13}
          strokeWidth={2.4}
        />
        <Text className={classes.voteReviewText}>Revisión</Text>
      </View>
    );
  }

  return (
    <Text
      accessibilityLabel={value === 0 ? "Cero confirmado" : `${value} votos`}
      className={
        size === "sm"
          ? `${classes.voteNumber} ${classes.voteNumberSm}`
          : size === "lg"
            ? `${classes.voteNumber} ${classes.voteNumberLg}`
            : classes.voteNumber
      }
      style={{
        color: value === 0 ? colors.primaryDark : colors.ink,
        fontVariant: ["tabular-nums"],
      }}
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
      className={
        isActive
          ? `${classes.actionCard} ${classes.actionCardPrimary}`
          : `${classes.actionCard} ${classes.actionCardSecondary}`
      }
    >
      {Icon ? (
        <View
          className={
            isActive
              ? `${classes.actionIcon} ${classes.actionIconPrimary}`
              : classes.actionIcon
          }
        >
          <Icon
            color={isActive ? colors.accent : colors.primary}
            size={22}
            strokeWidth={2.2}
          />
        </View>
      ) : null}
      <View className={classes.actionCopy}>
        {badge ? (
          <Text
            className={
              isActive
                ? `${classes.actionBadge} ${classes.actionBadgePrimary}`
                : classes.actionBadge
            }
          >
            {badge}
          </Text>
        ) : null}
        <Text
          className={
            isActive
              ? `${classes.actionTitle} ${classes.actionTitlePrimary}`
              : classes.actionTitle
          }
        >
          {title}
        </Text>
        <Text
          className={
            isActive
              ? `${classes.actionDescription} ${classes.actionDescriptionPrimary}`
              : classes.actionDescription
          }
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
    <View accessibilityRole="tablist" className={classes.segmentedTrack}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={option.key}
            onPress={() => onChange(option.key)}
            className={
              active
                ? `${classes.segmentedTab} ${classes.segmentedTabActive}`
                : classes.segmentedTab
            }
          >
            <Text
              numberOfLines={1}
              className={
                active
                  ? `${classes.segmentedText} ${classes.segmentedTextActive}`
                  : classes.segmentedText
              }
            >
              {option.label}
            </Text>
            {option.badge !== undefined ? (
              <View
                className={
                  active
                    ? `${classes.segmentedBadge} ${classes.segmentedBadgeActive}`
                    : classes.segmentedBadge
                }
              >
                <Text
                  className={
                    active
                      ? `${classes.segmentedBadgeText} ${classes.segmentedBadgeTextActive}`
                      : classes.segmentedBadgeText
                  }
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
      className={
        isActive
          ? `${classes.actionTile} ${classes.actionTilePrimary}`
          : `${classes.actionTile} ${classes.actionTileSecondary}`
      }
    >
      <View className={classes.actionTileTop}>
        <View
          className={
            isActive
              ? `${classes.actionIcon} ${classes.actionIconPrimary}`
              : classes.actionIcon
          }
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
      <View className={classes.actionTileCopy}>
        <Text
          className={
            isActive
              ? `${classes.actionTileTitle} ${classes.actionTitlePrimary}`
              : classes.actionTileTitle
          }
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          className={
            isActive
              ? `${classes.actionTileSubtitle} ${classes.actionDescriptionPrimary}`
              : classes.actionTileSubtitle
          }
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
    <View className={classes.empty}>
      <View className={classes.emptyMark}>
        <Inbox color={colors.primary} size={20} strokeWidth={2} />
      </View>
      <View className={classes.emptyCopy}>
        <Text accessibilityRole="header" className={classes.emptyTitle}>
          {title}
        </Text>
        <Text className={classes.emptyMessage}>{message}</Text>
      </View>
    </View>
  );
}

export function LoadingBlock({ message }: { message: string }) {
  return (
    <View className={classes.loadingBlock}>
      <LottieIcon name="loading" size={112} />
      <Text className={classes.loadingText}>{message}</Text>
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
    <View className={classes.workflow}>
      {steps.map((step, index) => {
        const isDone = step.state === "done";
        const isCurrent = step.state === "current";
        const isError = step.state === "error";
        const dotClass = isDone
          ? `${classes.workflowDot} ${classes.workflowDotDone}`
          : isCurrent
            ? `${classes.workflowDot} ${classes.workflowDotCurrent}`
            : isError
              ? `${classes.workflowDot} ${classes.workflowDotError}`
              : classes.workflowDot;
        const lineClass = isDone
          ? `${classes.workflowLine} ${classes.workflowLineDone}`
          : isError
            ? `${classes.workflowLine} ${classes.workflowLineError}`
            : classes.workflowLine;
        const labelClass = isCurrent
          ? `${classes.workflowLabel} ${classes.workflowLabelCurrent}`
          : isError
            ? `${classes.workflowLabel} ${classes.workflowLabelError}`
            : classes.workflowLabel;
        return (
          <View key={step.label} className={classes.workflowItem}>
            <View className={classes.workflowTop}>
              <View className={dotClass}>
                {isDone ? (
                  <Check color={colors.onPrimary} size={13} strokeWidth={3} />
                ) : isError ? (
                  <CircleAlert
                    color={colors.onPrimary}
                    size={13}
                    strokeWidth={2.6}
                  />
                ) : (
                  <View className={classes.workflowDotInner} />
                )}
              </View>
              {index < steps.length - 1 ? (
                <View className={lineClass} />
              ) : null}
            </View>
            <Text className={labelClass}>{step.label}</Text>
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
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.inkMuted }}
      onClose={() => {
        const intent = intentRef.current;
        intentRef.current = null;
        if (!intent && visible) {
          onCancel();
        }
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        <View className={classes.sheetContent}>
          <View className={classes.sheetAccent} style={{ backgroundColor: accent }} />
          <Text className={classes.sheetTitle}>{title}</Text>
          <Text className={classes.sheetMessage}>{message}</Text>
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
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const classes = {
  safeArea: "flex-1",
  flex: "flex-1",
  topRule: "h-[3px] bg-primary",
  content: "w-full max-w-[620px] grow self-center px-5 pb-6 pt-4",
  body: "flex-1 gap-4",
  masthead: "mb-5 mt-2 flex-row items-center gap-2",
  backButton:
    "h-10 w-10 items-center justify-center rounded-md border border-border bg-surface",
  brandMark:
    "h-[38px] w-[38px] items-center justify-center rounded-[10px] border-b-[3px] border-b-accent bg-primary",
  brandMarkText:
    "font-display text-[15px] font-bold tracking-[0.4px] text-on-primary",
  brandIdentity: "ml-[10px]",
  brandName:
    "font-display text-[20px] font-bold tracking-[-0.2px] text-primary-dark",
  brandTagline: "mt-[1px] font-body text-[12px] leading-4 text-ink-muted",
  mastheadLine: "ml-[14px] h-px flex-1 bg-border",
  heading: "mb-2",
  eyebrowRow: "mb-2 flex-row items-center gap-[7px]",
  eyebrowMark: "h-[2px] w-4 bg-primary",
  eyebrowText:
    "font-body-medium text-[13px] tracking-[0.5px] text-ink-muted",
  title: "font-display text-title font-bold text-primary-dark",
  description: "mt-2 font-body text-subtitle text-ink-muted",
  titleRule: "mt-4 h-[3px] w-9 bg-primary",
  field: "mb-1 gap-1",
  fieldLabelRow: "flex-row items-center justify-between",
  label: "font-body-medium text-label text-primary-dark",
  numericHint:
    "font-body text-[11px] tracking-[0.2px] text-ink-muted",
  inputWrap:
    "min-h-[54px] flex-row items-center gap-2 rounded-md border border-border bg-surface px-3",
  input: "min-h-[54px] flex-1 py-2 font-body text-[16px] text-ink",
  inputNumeric:
    "text-right font-display text-[22px] font-bold tracking-[0.3px]",
  passwordToggle: "h-8 w-8 items-center justify-center",
  inputFocused: "border-primary",
  inputError: "border-primary",
  fieldError:
    "font-body-medium text-[14px] leading-[19px] text-primary-dark",
  fieldHint: "font-body text-[13px] leading-[18px] text-ink-muted",
  button:
    "mt-2 min-h-[54px] flex-row items-center justify-between rounded-md bg-primary px-4",
  buttonDisabled: "opacity-[0.45]",
  buttonText: "flex-1 font-body-bold text-button text-on-primary",
  buttonArrow:
    "font-display text-[26px] leading-[26px] text-on-primary",
  secondaryButton:
    "mt-2 min-h-[50px] items-center justify-center rounded-md border border-border px-3",
  secondaryText:
    "font-body-bold text-[15px] leading-5 text-primary-dark",
  notice: "flex-row gap-3 rounded-md border bg-surface p-3",
  noticeMark: "mt-[1px] h-7 w-7 items-center justify-center rounded-sm",
  noticeMarkText: "font-display text-[17px] font-bold leading-5",
  noticeBody: "flex-1 gap-[3px]",
  noticeTitle: "font-body-bold text-[15px] leading-5 text-primary-dark",
  noticeMessage: "font-body text-[15px] leading-[21px] text-ink",
  noticeAction: "mt-1 self-start py-[2px]",
  noticeActionText: "font-body-bold text-[13px] text-primary",
  technical: "mt-1 gap-1",
  technicalToggle:
    "font-body-medium text-[13px] text-ink-muted underline",
  technicalText:
    "rounded-sm bg-background p-2 font-mono text-[12px] leading-[17px] text-ink-muted",
  chip: "flex-row items-center self-start gap-[6px] rounded-full border px-[10px] py-[6px]",
  chipDot: "h-[7px] w-[7px] rounded-[3px]",
  chipText: "font-body-medium text-[12px] leading-4",
  card: "rounded-lg border border-border bg-surface p-4",
  sectionRow: "flex-row items-center gap-2",
  sectionTitle: "font-body-bold text-section text-primary",
  sectionLine: "h-px flex-1 bg-border",
  metric: "min-w-0 gap-[2px]",
  metricValue: "font-display text-numeric font-bold text-primary-dark",
  metricLabel: "font-body text-[13px] leading-[18px] text-ink-muted",
  progressTrack: "h-2 w-full overflow-hidden rounded-full bg-border",
  progressFill: "h-full rounded-full",
  voteReview:
    "flex-row items-center self-start gap-[5px] rounded-full border border-accent-deep bg-accent-soft px-[9px] py-1",
  voteReviewSm: "px-[7px] py-[3px]",
  voteReviewDot: "h-[6px] w-[6px] rounded-[3px] bg-accent-deep",
  voteReviewText: "font-body-bold text-[12px] leading-4 text-accent-deep",
  voteNumber: "font-display text-[24px] font-bold leading-7",
  voteNumberSm: "text-[19px] leading-[23px]",
  voteNumberLg: "text-[30px] leading-[34px]",
  actionCard:
    "min-h-[92px] flex-row items-center justify-between gap-3 rounded-lg border p-4",
  actionCardPrimary: "border-primary bg-primary",
  actionCardSecondary: "border-border bg-surface",
  actionIcon:
    "h-12 w-12 items-center justify-center rounded-md bg-primary-soft-bg",
  actionIconPrimary: "bg-[rgba(255,255,255,0.16)]",
  actionTile:
    "min-h-[162px] min-w-[46%] flex-1 justify-between gap-4 rounded-lg border p-4",
  actionTilePrimary: "border-primary bg-primary",
  actionTileSecondary: "border-border bg-surface",
  actionTileTop: "flex-row items-center justify-between",
  actionTileCopy: "gap-1",
  actionTileTitle: "font-body-bold text-[18px] leading-[23px] text-ink",
  actionTileSubtitle: "font-body text-[14px] leading-[19px] text-ink-muted",
  segmentedTrack:
    "flex-row gap-1 rounded-md border border-border bg-surface p-1",
  segmentedTab:
    "min-h-10 flex-1 flex-row items-center justify-center gap-[6px] rounded-sm px-2",
  segmentedTabActive: "bg-primary",
  segmentedText: "font-body-medium text-[13px] text-ink-muted",
  segmentedTextActive: "font-body-bold text-on-primary",
  segmentedBadge: "rounded-full bg-primary-soft-bg px-[6px] py-[1px]",
  segmentedBadgeActive: "bg-accent",
  segmentedBadgeText: "font-body-bold text-[11px] text-primary",
  segmentedBadgeTextActive: "text-primary-dark",
  actionCopy: "flex-1 gap-[3px]",
  actionBadge:
    "mb-[2px] font-body-bold text-[11px] tracking-[0.8px] text-ink-muted",
  actionBadgePrimary: "text-primary-dark",
  actionTitle: "font-body-bold text-[18px] leading-[23px] text-primary-dark",
  actionTitlePrimary: "text-on-primary",
  actionDescription: "font-body text-[14px] leading-5 text-ink-muted",
  actionDescriptionPrimary: "text-on-primary-muted",
  actionArrow:
    "self-center font-display text-[30px] leading-[30px] text-primary-dark",
  actionArrowPrimary: "text-on-primary",
  empty: "flex-row items-center gap-3 rounded-lg border border-dashed border-border p-4",
  emptyMark: "h-10 w-10 items-center justify-center rounded-md bg-primary-soft-bg",
  emptyCopy: "flex-1 gap-[3px]",
  emptyTitle: "font-body-bold text-[15px] leading-5 text-primary-dark",
  emptyMessage: "font-body text-[13px] leading-[18px] text-ink-muted",
  loadingBlock: "items-center gap-3 py-8",
  loadingText: "text-center font-body text-[13px] leading-[18px] text-ink-muted",
  workflow: "flex-row",
  workflowItem: "flex-1 pr-[3px]",
  workflowTop: "flex-row items-center",
  workflowDot:
    "h-[22px] w-[22px] items-center justify-center rounded-[11px] border border-border bg-transparent",
  workflowDotDone: "border-primary bg-primary",
  workflowDotCurrent: "border-accent-deep bg-accent-deep",
  workflowDotError: "border-primary-dark bg-primary-dark",
  workflowDotInner: "h-[6px] w-[6px] rounded-[3px] bg-ink-muted",
  workflowDotText: "font-body-bold text-[11px] leading-[14px] text-ink-muted",
  workflowDotTextDone: "text-on-primary",
  workflowLine: "mx-1 h-px flex-1 bg-border",
  workflowLineDone: "bg-primary",
  workflowLineError: "bg-primary-dark",
  workflowLabel: "mt-[5px] font-body text-[12px] leading-4 text-ink-muted",
  workflowLabelCurrent: "font-body-bold text-accent-deep",
  workflowLabelError: "font-body-bold text-primary-dark",
  sheetBackground: "bg-surface",
  sheetHandle: "bg-ink-muted",
  sheetContent: "gap-2 px-5 pb-8 pt-3",
  sheetAccent: "mb-1 h-1 w-[42px] rounded-[2px]",
  sheetTitle:
    "font-display text-[24px] font-bold leading-7 tracking-[-0.2px] text-primary-dark",
  sheetMessage: "mb-2 font-body text-[15px] leading-[21px] text-ink",
} as const;