import type { Control, FieldValues, Path } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useController } from "react-hook-form";

export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>Control Electoral</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  autoComplete,
  textContentType,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
}) {
  const { field, fieldState } = useController({ control, name });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        onBlur={field.onBlur}
        onChangeText={field.onChange}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        secureTextEntry={secureTextEntry}
        style={[styles.input, fieldState.error ? styles.inputError : null]}
        textContentType={textContentType}
        value={typeof field.value === "string" ? field.value : ""}
      />
      {fieldState.error?.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {fieldState.error.message}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.secondaryPressed : null,
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function Feedback({
  message,
  kind = "error",
}: {
  message: string;
  kind?: "error" | "success" | "info";
}) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.feedback,
        kind === "success" ? styles.success : null,
        kind === "info" ? styles.info : null,
      ]}
    >
      {message}
    </Text>
  );
}

export function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  brand: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 32,
  },
  heading: {
    gap: 8,
    marginBottom: 24,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  description: {
    color: "#4B5563",
    fontSize: 16,
    lineHeight: 23,
  },
  field: {
    gap: 6,
    marginBottom: 16,
  },
  label: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderColor: "#9CA3AF",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111827",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: "#B91C1C",
  },
  fieldError: {
    color: "#B91C1C",
    fontSize: 13,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  secondaryPressed: {
    backgroundColor: "#F3F4F6",
  },
  secondaryText: {
    color: "#1F2937",
    fontSize: 15,
    fontWeight: "600",
  },
  feedback: {
    color: "#B91C1C",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  success: {
    color: "#166534",
  },
  info: {
    color: "#374151",
  },
});
