import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// =========================================================================
/// DIÁLOGO MODAL: GESTIÓN DE USUARIOS Y SALDO A FAVOR (Flutter)
/// Especificación Técnica ManaBros: §1.1, §3.2, §5.7, §5.8
///
/// Características principales:
/// 1. Admin Guard (§5.7): Solo accesible por usuarios con rol 'admin'.
/// 2. Búsqueda y listado en tiempo real de todos los usuarios registrados.
/// 3. Confirmación de cuenta (§3.2): Activa usuarios nuevos 'unconfirmed'.
/// 4. Gestión de Saldo a Favor (§5.8): Carga y salida de saldos con motivo.
/// 5. Historial auditado de movimientos de saldo en tiempo real.
/// =========================================================================

class UsersManagerDialog extends StatefulWidget {
  final UserProfile currentUser;

  const UsersManagerDialog({
    super.key,
    required this.currentUser,
  });

  /// Método estático de conveniencia para invocar el diálogo
  static Future<void> show(
    BuildContext context, {
    required UserProfile currentUser,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.85),
      builder: (ctx) => UsersManagerDialog(currentUser: currentUser),
    );
  }

  @override
  State<UsersManagerDialog> createState() => _UsersManagerDialogState();
}

class _UsersManagerDialogState extends State<UsersManagerDialog> {
  final FirestoreService _firestoreService = FirestoreService();

  // Estados locales
  String _searchQuery = '';
  UserProfile? _selectedUser;
  bool _isProcessing = false;

  // Estados para formulario de saldo (Abono / Salida)
  String? _balanceAction; // 'credit' | 'outflow' | null
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  String? _balanceError;

  @override
  void dispose() {
    _amountController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  // Confirmar cuenta de usuario (§3.2)
  Future<void> _handleConfirmUser(UserProfile user) async {
    setState(() => _isProcessing = true);
    try {
      await _firestoreService.confirmUser(user.uid);
      _showSnackBar('Usuario \${user.displayName} confirmado exitosamente');
    } catch (e) {
      _showSnackBar('Error al confirmar usuario: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  // Guardar abono o salida de saldo (§5.8)
  Future<void> _handleSaveBalanceMutation() async {
    if (_selectedUser == null || _balanceAction == null) return;

    final amountText = _amountController.text.trim().replaceAll(',', '.');
    final amount = double.tryParse(amountText);
    if (amount == null || amount <= 0) {
      setState(() => _balanceError = 'Ingresa un monto válido mayor a 0');
      return;
    }

    final desc = _descController.text.trim();
    if (desc.isEmpty) {
      setState(() => _balanceError = 'La descripción o motivo es obligatoria');
      return;
    }

    if (_balanceAction == 'outflow' && amount > _selectedUser!.balance) {
      setState(() => _balanceError = 'No puede superar el saldo actual (\\$\${_selectedUser!.balance.toStringAsFixed(2)})');
      return;
    }

    setState(() {
      _balanceError = null;
      _isProcessing = true;
    });

    try {
      await _firestoreService.addBalanceMovement(
        userUid: _selectedUser!.uid,
        userEmail: _selectedUser!.email,
        amount: amount,
        type: _balanceAction!,
        description: desc,
        registeredBy: widget.currentUser.email,
      );

      final isCredit = _balanceAction == 'credit';
      _showSnackBar(
        isCredit
            ? 'Se agregaron \\$\${amount.toStringAsFixed(2)} USD a \${_selectedUser!.displayName}'
            : 'Salida de \\$\${amount.toStringAsFixed(2)} USD registrada para \${_selectedUser!.displayName}',
      );

      // Limpiar formulario
      setState(() {
        _balanceAction = null;
        _amountController.clear();
        _descController.clear();
        _balanceError = null;
      });
    } catch (e) {
      setState(() => _balanceError = 'Error: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  // Diálogo modal de historial de movimientos de saldo
  void _openMovementsHistoryModal(UserProfile user) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF161B22),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF30363D)),
          ),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          contentPadding: const EdgeInsets.symmetric(horizontal: 20),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Historial de Movimientos',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.displayName,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ],
          ),
          content: SizedBox(
            width: 480,
            height: 380,
            child: StreamBuilder<List<BalanceMovement>>(
              stream: _firestoreService.getUserMovementsStream(user.email),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                  );
                }

                final movements = snapshot.data ?? [];
                if (movements.isEmpty) {
                  return const Center(
                    child: Text(
                      'Sin movimientos registrados',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    ),
                  );
                }

                return ListView.separated(
                  itemCount: movements.length,
                  separatorBuilder: (_, __) => const Divider(color: Color(0xFF30363D), height: 1),
                  itemBuilder: (context, index) {
                    final m = movements[index];
                    final isCredit = m.type == 'credit';
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: isCredit
                                  ? const Color(0xFF10B981).withOpacity(0.15)
                                  : const Color(0xFFEF4444).withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isCredit ? Icons.arrow_downward : Icons.arrow_upward,
                              size: 14,
                              color: isCredit ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  m.description.isNotEmpty ? m.description : 'Ajuste de saldo',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '\${m.createdAt.day.toString().padLeft(2, '0')}/\${m.createdAt.month.toString().padLeft(2, '0')}/\${m.createdAt.year} · \${m.registeredBy}',
                                  style: const TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '\${isCredit ? "+" : "-"}\\$\${m.amount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: isCredit ? const Color(0xFF34D399) : const Color(0xFFF87171),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFF21262D),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Cerrar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // 1. Guard de Administrador (§5.7)
    if (!widget.currentUser.isAdmin) {
      return Dialog(
        backgroundColor: const Color(0xFF161B22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF30363D)),
        ),
        child: Container(
          width: 380,
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 36),
              ),
              const SizedBox(height: 16),
              const Text(
                'Acceso Restringido',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'No tienes permisos de Administrador para gestionar usuarios y saldos (§5.7).',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF21262D),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Cerrar'),
              ),
            ],
          ),
        ),
      );
    }

    final isNarrow = MediaQuery.of(context).size.width < 768;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        width: 900,
        height: 640,
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(18),
          border: Border.Border.all(color: const Color(0xFF30363D)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 25,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: StreamBuilder<List<UserProfile>>(
            stream: _firestoreService.getUsersStream(),
            builder: (context, snapshot) {
              final users = snapshot.data ?? [];
              final unconfirmedCount = users.where((u) => u.status == 'unconfirmed').length;

              // Filtrado por buscador
              final filteredUsers = users.where((u) {
                final q = _searchQuery.toLowerCase();
                return u.displayName.toLowerCase().contains(q) || u.email.toLowerCase().contains(q);
              }).toList();

              // Mantener referencia fresca al usuario seleccionado
              UserProfile? activeSelected = _selectedUser;
              if (activeSelected != null) {
                final found = users.where((u) => u.uid == activeSelected!.uid);
                if (found.isNotEmpty) {
                  activeSelected = found.first;
                }
              }

              return Column(
                children: [
                  // Header
                  _buildHeader(context, users.length, unconfirmedCount),

                  // Barra de progreso si está procesando
                  if (_isProcessing)
                    const LinearProgressIndicator(
                      backgroundColor: Color(0xFF21262D),
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
                      minHeight: 2,
                    ),

                  // Contenido principal
                  Expanded(
                    child: isNarrow
                        ? _buildNarrowLayout(filteredUsers, activeSelected)
                        : _buildWideSplitLayout(filteredUsers, activeSelected),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  // Header del modal
  Widget _buildHeader(BuildContext context, int totalUsers, int unconfirmedCount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.admin_panel_settings, color: Color(0xFFF59E0B), size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Gestión de Usuarios',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        '$totalUsers usuario\${totalUsers == 1 ? "" : "s"} registrados',
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      ),
                      if (unconfirmedCount > 0) ...[
                        const Text(' · ', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                        Text(
                          '$unconfirmedCount sin confirmar',
                          style: const TextStyle(
                            color: Color(0xFFF59E0B),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  // Vista Split (Desktop / Tablet)
  Widget _buildWideSplitLayout(List<UserProfile> users, UserProfile? selectedUser) {
    return Row(
      children: [
        // Columna Izquierda: Lista de Usuarios (60% ancho)
        Expanded(
          flex: 6,
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xFF0D1117),
              border: Border(right: BorderSide(color: Color(0xFF30363D))),
            ),
            child: Column(
              children: [
                // Input de búsqueda
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Buscar por nombre o email...',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 18),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ),
                ),

                // Lista scrolleable
                Expanded(
                  child: users.isEmpty
                      ? const Center(
                          child: Text(
                            'No se encontraron usuarios',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          itemCount: users.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 6),
                          itemBuilder: (context, idx) {
                            final u = users[idx];
                            final isSelected = selectedUser?.uid == u.uid;
                            return _buildUserListTile(u, isSelected);
                          },
                        ),
                ),
              ],
            ),
          ),
        ),

        // Columna Derecha: Detalle y Acciones del Usuario (40% ancho)
        Expanded(
          flex: 5,
          child: Container(
            color: const Color(0xFF161B22),
            child: selectedUser == null
                ? _buildEmptySelectionState()
                : _buildUserDetailPanel(selectedUser),
          ),
        ),
      ],
    );
  }

  // Vista Mobile / Estrecha
  Widget _buildNarrowLayout(List<UserProfile> users, UserProfile? selectedUser) {
    if (selectedUser != null) {
      return Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: const Color(0xFF21262D),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                  onPressed: () => setState(() => _selectedUser = null),
                ),
                const SizedBox(width: 8),
                const Text('Volver a la lista', style: TextStyle(color: Colors.white, fontSize: 13)),
              ],
            ),
          ),
          Expanded(child: _buildUserDetailPanel(selectedUser)),
        ],
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            onChanged: (val) => setState(() => _searchQuery = val),
            style: const TextStyle(color: Colors.white, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Buscar por nombre o email...',
              hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
              prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 18),
              filled: true,
              fillColor: const Color(0xFF0D1117),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF30363D)),
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(8),
            itemCount: users.length,
            separatorBuilder: (_, __) => const SizedBox(height: 6),
            itemBuilder: (context, idx) {
              final u = users[idx];
              return _buildUserListTile(u, false);
            },
          ),
        ),
      ],
    );
  }

  // Item de la lista de usuarios
  Widget _buildUserListTile(UserProfile user, bool isSelected) {
    final isConfirmed = user.status == 'confirmed';
    final hasBalance = user.balance > 0;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedUser = user;
          _balanceAction = null;
          _balanceError = null;
        });
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF21262D) : const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFF30363D),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF30363D),
              backgroundImage: user.photoURL.isNotEmpty ? NetworkImage(user.photoURL) : null,
              child: user.photoURL.isEmpty
                  ? Text(
                      user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    )
                  : null,
            ),
            const SizedBox(width: 12),

            // Info principal
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          user.displayName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (user.isAdmin) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.2),
                            border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.5)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'ADMIN',
                            style: TextStyle(
                              color: Color(0xFFF59E0B),
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user.email,
                    style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            const SizedBox(width: 8),

            // Saldo y Badge de Estado
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\\$\${user.balance.toStringAsFixed(2)} USD',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: hasBalance ? const Color(0xFF34D399) : const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isConfirmed
                        ? const Color(0xFF10B981).withOpacity(0.15)
                        : const Color(0xFFF59E0B).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isConfirmed
                          ? const Color(0xFF10B981).withOpacity(0.4)
                          : const Color(0xFFF59E0B).withOpacity(0.4),
                    ),
                  ),
                  child: Text(
                    isConfirmed ? 'Confirmado' : 'Sin confirmar',
                    style: TextStyle(
                      color: isConfirmed ? const Color(0xFF34D399) : const Color(0xFFF59E0B),
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // Panel derecho: Detalle del usuario seleccionado
  Widget _buildUserDetailPanel(UserProfile user) {
    final isConfirmed = user.status == 'confirmed';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Perfil Header
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: const Color(0xFF30363D),
                backgroundImage: user.photoURL.isNotEmpty ? NetworkImage(user.photoURL) : null,
                child: user.photoURL.isEmpty
                    ? Text(
                        user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.displayName,
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user.email,
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          user.role.toUpperCase(),
                          style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: isConfirmed
                                ? const Color(0xFF10B981).withOpacity(0.15)
                                : const Color(0xFFF59E0B).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isConfirmed
                                  ? const Color(0xFF10B981).withOpacity(0.4)
                                  : const Color(0xFFF59E0B).withOpacity(0.4),
                            ),
                          ),
                          child: Text(
                            isConfirmed ? 'Confirmado' : 'Sin confirmar',
                            style: TextStyle(
                              color: isConfirmed ? const Color(0xFF34D399) : const Color(0xFFF59E0B),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Banner de usuario sin confirmar (§3.2)
          if (!isConfirmed) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.1),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.35)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.info_outline, color: Color(0xFFF59E0B), size: 16),
                      SizedBox(width: 8),
                      Text(
                        'Usuario Pendiente de Aprobación',
                        style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Este usuario requiere confirmación para poder participar en órdenes activas y agregar cartas.',
                    style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, height: 1.3),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.check_circle_outline, size: 16),
                      label: const Text('Confirmar cuenta'),
                      onPressed: () => _handleConfirmUser(user),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: const Color(0xFF0D1117),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Tarjeta de Saldo a Favor (§5.8)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Saldo a Favor en Perfil',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '\\$\${user.balance.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        color: Color(0xFF34D399),
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text('USD', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'El saldo se acumula automáticamente al liquidar órdenes con excedentes o mediante abonos manuales del admin.',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 11, height: 1.3),
                ),
                const SizedBox(height: 14),

                // Botones de acción de saldo
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.add, size: 15),
                        label: const Text('Agregar saldo'),
                        onPressed: () {
                          setState(() {
                            _balanceAction = 'credit';
                            _amountController.clear();
                            _descController.clear();
                            _balanceError = null;
                          });
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF21262D),
                          foregroundColor: const Color(0xFF34D399),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(color: const Color(0xFF10B981).withOpacity(0.3)),
                          ),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.remove, size: 15),
                        label: const Text('Registrar salida'),
                        onPressed: user.balance <= 0
                            ? null
                            : () {
                                setState(() {
                                  _balanceAction = 'outflow';
                                  _amountController.clear();
                                  _descController.clear();
                                  _balanceError = null;
                                });
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF21262D),
                          foregroundColor: const Color(0xFFF87171),
                          disabledBackgroundColor: const Color(0xFF161B22),
                          disabledForegroundColor: const Color(0xFF475569),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(
                              color: user.balance > 0
                                  ? const Color(0xFFEF4444).withOpacity(0.3)
                                  : Colors.transparent,
                            ),
                          ),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // Botón ver historial
                SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    icon: const Icon(Icons.history, size: 15, color: Color(0xFF94A3B8)),
                    label: const Text(
                      'Ver historial de movimientos',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                    onPressed: () => _openMovementsHistoryModal(user),
                  ),
                ),
              ],
            ),
          ),

          // Formulario Inline de Abono o Salida
          if (_balanceAction != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _balanceAction == 'credit' ? 'Agregar Saldo a Favor' : 'Registrar Salida de Saldo',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16, color: Color(0xFF94A3B8)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => setState(() => _balanceAction = null),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Input Monto
                  const Text('Monto (\\$ USD)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Ej. 15.00',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Input Descripción
                  const Text('Motivo / Descripción (obligatoria)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _descController,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: InputDecoration(
                      hintText: 'Ej. Devolución de carta agotada',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFF30363D)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                      ),
                    ),
                  ),

                  // Mensaje de error
                  if (_balanceError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _balanceError!,
                      style: const TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],

                  const SizedBox(height: 12),

                  // Botones cancelar y confirmar
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => setState(() => _balanceAction = null),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFF94A3B8),
                          textStyle: const TextStyle(fontSize: 12),
                        ),
                        child: const Text('Cancelar'),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _isProcessing ? null : _handleSaveBalanceMutation,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF59E0B),
                          foregroundColor: const Color(0xFF0D1117),
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        child: const Text('Guardar'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // Estado cuando no hay usuario seleccionado
  Widget _buildEmptySelectionState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.person_search_outlined, size: 48, color: Color(0xFF475569)),
            SizedBox(height: 12),
            Text(
              'Selecciona un usuario',
              style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 6),
            Text(
              'Haz clic en cualquier usuario de la lista para revisar su estado, confirmar su cuenta o gestionar su saldo a favor.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B), fontSize: 12, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
