import 'package:flutter/material.dart';
import '../models/purchases_models.dart';
import '../services/firestore_service.dart';

/// Pantalla de Entrada Masiva de Cartas (§5.11, §8.3)
class MassEntryScreen extends StatefulWidget {
  final String orderId;
  final String currentUserEmail;
  final String currentUserName;

  const MassEntryScreen({
    super.key,
    required this.orderId,
    required this.currentUserEmail,
    required this.currentUserName,
  });

  @override
  State<MassEntryScreen> createState() => _MassEntryScreenState();
}

class _MassEntryScreenState extends State<MassEntryScreen> {
  final TextEditingController _textController = TextEditingController();
  final FirestoreService _firestore = FirestoreService();
  String _defaultCondition = 'NM';
  bool _isFoil = false;
  List<_ParsedCardLine> _parsedCards = [];
  bool _isSaving = false;

  // Regex para formato estándar: "4 Lightning Bolt [M25] NM $2.50" o "4 Sol Ring"
  static final RegExp _cardRegex = RegExp(
    r'^(\\d+)x?\\s+([^\\[\\$\\n]+)(?:\\[([^\\]]+)\\])?(?:\\s+(NM|EX|VG|G))?(?:\\s*\\$\\s*([0-9]+\\.[0-9]{2}))?',
    caseSensitive: false,
  );

  void _parseLines(String text) {
    final lines = text.split('\\n');
    final List<_ParsedCardLine> results = [];

    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) continue;

      final match = _cardRegex.firstMatch(trimmed);
      if (match != null) {
        final qty = int.tryParse(match.group(1) ?? '1') ?? 1;
        final name = match.group(2)?.trim() ?? '';
        final edition = match.group(3)?.trim() ?? 'CK';
        final condition = match.group(4)?.trim().toUpperCase() ?? _defaultCondition;
        final price = double.tryParse(match.group(5) ?? '') ?? 0.0;

        results.add(_ParsedCardLine(
          name: name,
          quantity: qty,
          edition: edition,
          condition: condition,
          price: price,
          foil: _isFoil,
        ));
      } else {
        // Fallback para nombres simples: "Sol Ring"
        results.add(_ParsedCardLine(
          name: trimmed,
          quantity: 1,
          edition: 'CK',
          condition: _defaultCondition,
          price: 0.0,
          foil: _isFoil,
        ));
      }
    }

    setState(() {
      _parsedCards = results;
    });
  }

  Future<void> _commitCardsToOrder() async {
    if (_parsedCards.isEmpty) return;

    setState(() => _isSaving = true);
    try {
      for (final card in _parsedCards) {
        await _firestore.addOrUpsertOrderItem(
          orderId: widget.orderId,
          buyerEmail: widget.currentUserEmail,
          buyerName: widget.currentUserName,
          cardName: card.name,
          edition: card.edition,
          condition: card.condition,
          foil: card.foil,
          price: card.price,
          quantityToAdd: card.quantity,
          imageUrl: '',
          pageUrl: '',
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('\${_parsedCards.length} cartas agregadas a la orden exitosamente.'),
          ),
        );
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        title: const Text('Carga Masiva de Cartas (§5.11)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Controles de Configuración Rápida
            Row(
              children: [
                const Text('Condición default:', style: TextStyle(color: Color(0xFF8B949E), fontSize: 12)),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _defaultCondition,
                  dropdownColor: const Color(0xFF161B22),
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  items: const ['NM', 'EX', 'VG', 'G'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _defaultCondition = val);
                  },
                ),
                const Spacer(),
                FilterChip(
                  label: const Text('FOIL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  selected: _isFoil,
                  selectedColor: const Color(0xFFFBBF24),
                  backgroundColor: const Color(0xFF21262D),
                  onSelected: (val) => setState(() => _isFoil = val),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Textarea para pegar listas
            Expanded(
              flex: 2,
              child: TextField(
                controller: _textController,
                maxLines: null,
                expands: true,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Pega aquí tu lista:\\n4 Lightning Bolt [M25] NM \$2.50\\n2 Counterspell [EMA]\\n1 Sol Ring',
                  hintStyle: const TextStyle(color: Colors.white24, fontSize: 12),
                  filled: true,
                  fillColor: const Color(0xFF161B22),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF30363D))),
                ),
                onChanged: _parseLines,
              ),
            ),
            const SizedBox(height: 12),

            // Vista Previa de Detección
            Text(
              'Vista Previa (\${_parsedCards.length} detectadas)',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 6),
            Expanded(
              flex: 2,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF161B22),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF30363D)),
                ),
                child: _parsedCards.isEmpty
                    ? const Center(child: Text('Escribe o pega una lista arriba', style: TextStyle(color: Color(0xFF8B949E), fontSize: 12)))
                    : ListView.separated(
                        itemCount: _parsedCards.length,
                        separatorBuilder: (_, __) => const Divider(color: Color(0xFF21262D), height: 1),
                        itemBuilder: (context, i) {
                          final c = _parsedCards[i];
                          return ListTile(
                            dense: true,
                            leading: CircleAvatar(
                              radius: 12,
                              backgroundColor: const Color(0xFF21262D),
                              child: Text('\${c.quantity}x', style: const TextStyle(fontSize: 10, color: Color(0xFFFBBF24))),
                            ),
                            title: Text(c.name, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            subtitle: Text('\${c.edition} · \${c.condition} \${c.foil ? "• FOIL" : ""}',
                                style: const TextStyle(color: Color(0xFF8B949E), fontSize: 10)),
                            trailing: Text('\\$\${c.price.toStringAsFixed(2)}',
                                style: const TextStyle(fontFamily: 'monospace', color: Color(0xFF34D399), fontSize: 12)),
                          );
                        },
                      ),
              ),
            ),
            const SizedBox(height: 16),

            // Botón de Confirmación
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                icon: _isSaving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Color(0xFF0D1117), strokeWidth: 2))
                    : const Icon(Icons.file_download_done_rounded),
                label: Text(
                  _isSaving ? 'Guardando en Orden...' : 'Importar \${_parsedCards.length} Cartas a la Orden',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFBBF24),
                  foregroundColor: const Color(0xFF0D1117),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _parsedCards.isEmpty || _isSaving ? null : _commitCardsToOrder,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParsedCardLine {
  final String name;
  final int quantity;
  final String edition;
  final String condition;
  final double price;
  final bool foil;

  _ParsedCardLine({
    required this.name,
    required this.quantity,
    required this.edition,
    required this.condition,
    required this.price,
    required this.foil,
  });
}
