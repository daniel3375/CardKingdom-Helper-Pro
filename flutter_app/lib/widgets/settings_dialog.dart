import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/purchases_models.dart';

/// Modelo de Ajustes Globales de la Aplicación (§5.9)
class AppSettings {
  final String theme; // 'dark' | 'light' | 'system'
  final bool historyEnabled;
  final bool buyersViewHistory;
  final bool useProxy;

  AppSettings({
    this.theme = 'dark',
    this.historyEnabled = true,
    this.buyersViewHistory = true,
    this.useProxy = true,
  });

  factory AppSettings.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return AppSettings(
      theme: data['theme'] ?? 'dark',
      historyEnabled: data['historyEnabled'] ?? true,
      buyersViewHistory: data['buyersViewHistory'] ?? true,
      useProxy: data['useProxy'] ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'theme': theme,
      'historyEnabled': historyEnabled,
      'buyersViewHistory': buyersViewHistory,
      'useProxy': useProxy,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  AppSettings copyWith({
    String? theme,
    bool? historyEnabled,
    bool? buyersViewHistory,
    bool? useProxy,
  }) {
    return AppSettings(
      theme: theme ?? this.theme,
      historyEnabled: historyEnabled ?? this.historyEnabled,
      buyersViewHistory: buyersViewHistory ?? this.buyersViewHistory,
      useProxy: useProxy ?? this.useProxy,
    );
  }
}

/// Diálogo Modal de Ajustes y Configuración (§5.9)
class SettingsDialog extends StatefulWidget {
  final UserProfile currentUser;
  final VoidCallback onLogout;
  final Function(AppSettings)? onSettingsChanged;

  const SettingsDialog({
    super.key,
    required this.currentUser,
    required this.onLogout,
    this.onSettingsChanged,
  });

  /// Método estático de conveniencia para invocar el modal
  static Future<void> show(
    BuildContext context, {
    required UserProfile currentUser,
    required VoidCallback onLogout,
    Function(AppSettings)? onSettingsChanged,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (ctx) => SettingsDialog(
        currentUser: currentUser,
        onLogout: onLogout,
        onSettingsChanged: onSettingsChanged,
      ),
    );
  }

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  AppSettings _settings = AppSettings();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final doc = await _firestore.collection('app_settings').doc('global').get();
      if (doc.exists && mounted) {
        setState(() {
          _settings = AppSettings.fromFirestore(doc);
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateSetting(AppSettings updated, String message) async {
    setState(() => _settings = updated);
    widget.onSettingsChanged?.call(updated);

    try {
      await _firestore
          .collection('app_settings')
          .doc('global')
          .set(updated.toMap(), SetOptions(merge: true));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 16),
                const SizedBox(width: 8),
                Text(message, style: const TextStyle(fontSize: 12)),
              ],
            ),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      // Manejar error de permisos si no es admin
    }
  }

  void _clearImageCache() {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF10B981),
        content: Text('Caché de imágenes liberada correctamente.'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF30363D)),
        ),
        title: const Text('Cerrar sesión', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: const Text(
          '¿Estás seguro de que deseas cerrar sesión en este dispositivo?',
          style: TextStyle(color: Color(0xFF8B949E), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              Navigator.of(context).pop();
              widget.onLogout();
            },
            child: const Text('Cerrar Sesión', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = widget.currentUser;
    final isAdmin = currentUser.role == 'admin';

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFF30363D)),
          boxShadow: const [
            BoxShadow(
              color: Colors.black87,
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ==========================================
              // 1. HEADER & PERFIL DE USUARIO
              // ==========================================
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Color(0xFF0D1117),
                  border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: const Color(0xFF21262D),
                      backgroundImage: currentUser.photoURL.isNotEmpty
                          ? NetworkImage(currentUser.photoURL)
                          : null,
                      child: currentUser.photoURL.isEmpty
                          ? Text(
                              currentUser.displayName.isNotEmpty
                                  ? currentUser.displayName[0].toUpperCase()
                                  : '?',
                              style: const TextStyle(
                                color: Color(0xFFFBBF24),
                                fontWeight: FontWeight.bold,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  currentUser.displayName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              _buildRoleBadge(currentUser.role),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            currentUser.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white70),
                      onPressed: () => Navigator.of(context).pop(),
                      splashRadius: 18,
                    ),
                  ],
                ),
              ),

              // ==========================================
              // 2. CUERPO DE AJUSTES SCROLLABLE
              // ==========================================
              Flexible(
                child: _isLoading
                    ? const Padding(
                        padding: EdgeInsets.all(32),
                        child: Center(
                          child: CircularProgressIndicator(color: Color(0xFFFBBF24)),
                        ),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // SECCIÓN APARIENCIA (§5.9)
                            _buildSectionHeader('APARIENCIA', Icons.palette_outlined),
                            const SizedBox(height: 10),
                            _buildThemeSelector(),

                            const SizedBox(height: 24),

                            // SECCIÓN AJUSTES DE ADMINISTRADOR (§5.9)
                            _buildSectionHeader('AJUSTES DE ADMINISTRADOR', Icons.admin_panel_settings_outlined),
                            const SizedBox(height: 10),
                            if (isAdmin) ...[
                              _buildSettingSwitchTile(
                                title: 'Historial de compra',
                                subtitle: 'Habilita o deshabilita la pestaña "Mis órdenes" para todos los compradores.',
                                value: _settings.historyEnabled,
                                icon: Icons.history_rounded,
                                onChanged: (val) {
                                  _updateSetting(
                                    _settings.copyWith(historyEnabled: val),
                                    'Historial \${val ? "habilitado" : "deshabilitado"}',
                                  );
                                },
                              ),
                              if (_settings.historyEnabled) ...[
                                const SizedBox(height: 10),
                                _buildSettingSwitchTile(
                                  title: 'Ver solo tus items',
                                  subtitle: _settings.buyersViewHistory
                                      ? 'Los compradores ven su historial con solo sus items.'
                                      : 'Los compradores ven el detalle completo de cada orden.',
                                  value: _settings.buyersViewHistory,
                                  icon: Icons.visibility_outlined,
                                  onChanged: (val) {
                                    _updateSetting(
                                      _settings.copyWith(buyersViewHistory: val),
                                      val
                                          ? 'Compradores verán solo sus items'
                                          : 'Compradores verán orden completa',
                                    );
                                  },
                                ),
                              ],
                            ] else
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0D1117),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF30363D)),
                                ),
                                child: const Text(
                                  'Próximamente podrás configurar ajustes de la aplicación.',
                                  style: TextStyle(fontSize: 12, color: Color(0xFF8B949E)),
                                ),
                              ),

                            const SizedBox(height: 24),

                            // SECCIÓN RED & RENDIMIENTO (§5.9)
                            _buildSectionHeader('RED & RENDIMIENTO', Icons.network_check_rounded),
                            const SizedBox(height: 10),
                            _buildSettingSwitchTile(
                              title: 'Proxy de descargas',
                              subtitle: 'Usa proxy para consultar el catálogo de Card Kingdom.',
                              value: _settings.useProxy,
                              icon: Icons.language_rounded,
                              activeColor: const Color(0xFF10B981),
                              onChanged: (val) {
                                _updateSetting(
                                  _settings.copyWith(useProxy: val),
                                  'Proxy \${val ? "activado" : "desactivado"}',
                                );
                              },
                            ),
                            const SizedBox(height: 10),
                            InkWell(
                              onTap: _clearImageCache,
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0D1117),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF30363D)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.image_outlined, size: 20, color: Color(0xFF8B949E)),
                                    const SizedBox(width: 12),
                                    const Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Limpiar caché de imágenes',
                                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                                          ),
                                          Text(
                                            'Libera espacio en memoria y disco',
                                            style: TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF21262D),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Text(
                                        'Limpiar',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFBBF24)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Saldo del usuario si existe
                            if (currentUser.balance > 0) ...[
                              const SizedBox(height: 24),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF064E3B).withOpacity(0.4),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Row(
                                      children: [
                                        Icon(Icons.account_balance_wallet_rounded, size: 18, color: Color(0xFF34D399)),
                                        SizedBox(width: 8),
                                        Text('Saldo a Favor', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                                      ],
                                    ),
                                    Text(
                                      '\\$\${currentUser.balance.toStringAsFixed(2)} USD',
                                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Color(0xFF34D399), fontSize: 14),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            const SizedBox(height: 24),

                            // Botón de Cerrar Sesión
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.logout_rounded, size: 16),
                                label: const Text('Cerrar sesión', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFF87171),
                                  side: const BorderSide(color: Color(0xFF7F1D1D)),
                                  backgroundColor: const Color(0xFF450A0A).withOpacity(0.3),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                onPressed: _confirmLogout,
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 14, color: const Color(0xFFFBBF24)),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            color: Color(0xFF8B949E),
          ),
        ),
      ],
    );
  }

  Widget _buildThemeSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(
        children: [
          _buildThemeOption('dark', 'Oscuro', Icons.nightlight_round),
          _buildThemeOption('light', 'Claro', Icons.wb_sunny_rounded),
          _buildThemeOption('system', 'Sistema', Icons.brightness_auto_rounded),
        ],
      ),
    );
  }

  Widget _buildThemeOption(String key, String label, IconData icon) {
    final isSelected = _settings.theme == key;

    return Expanded(
      child: InkWell(
        onTap: () {
          _updateSetting(_settings.copyWith(theme: key), 'Tema \$label configurado');
        },
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF21262D) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: isSelected ? Border.all(color: const Color(0xFFFBBF24).withOpacity(0.4)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: isSelected ? const Color(0xFFFBBF24) : const Color(0xFF8B949E)),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? const Color(0xFFFBBF24) : const Color(0xFF8B949E),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required IconData icon,
    required ValueChanged<bool> onChanged,
    Color activeColor = const Color(0xFFFBBF24),
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 20, color: activeColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: value,
            activeColor: activeColor,
            activeTrackColor: activeColor.withOpacity(0.3),
            inactiveThumbColor: const Color(0xFF8B949E),
            inactiveTrackColor: const Color(0xFF21262D),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: const Color(0xFF78350F).withOpacity(0.6),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
      ),
      child: Text(
        role.toUpperCase(),
        style: const TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.bold,
          color: Color(0xFFFBBF24),
        ),
      ),
    );
  }
}
